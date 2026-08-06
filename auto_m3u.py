import subprocess
import requests
import os
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed

# এখানে আপনার আনলিমিটেড M3U লিংকগুলো কমা (,) দিয়ে যুক্ত করুন
M3U_SOURCES = [
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/sm-live.m3u",
    "https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/refs/heads/main/toffee_OTT_Navigator.m3u",
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/criticx.m3u",
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/verse.m3u",
]

WORKING_FILE = "working.m3u"
THREADS = 20  # গিটহাব সার্ভারে থ্রেড বেশি দেওয়া যায়
TIMEOUT = 10
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def load_all_m3u(sources):
    headers = {"User-Agent": USER_AGENT}
    all_items = []
    
    for source in sources:
        print(f"📥 লোড হচ্ছে: {source}")
        try:
            if source.startswith("http"):
                response = requests.get(source, headers=headers, timeout=20)
                text = response.text.splitlines()
            else:
                with open(source, encoding="utf-8", errors="ignore") as f:
                    text = f.readlines()
            
            i = 0
            while i < len(text):
                line = text[i].strip()
                if line.startswith("#EXTINF"):
                    if i + 1 < len(text):
                        url = text[i + 1].strip()
                        if url and not url.startswith("#"):
                            all_items.append((line, url))
                    i += 2
                else:
                    i += 1
        except Exception as e:
            print(f"❌ এরর ({source}): {e}")
            
    # ডুপ্লিকেট লিংক রিমুভ করা (যাতে একই চ্যানেল দুইবার না থাকে)
    unique_items = {}
    for extinf, url in all_items:
        unique_items[url] = extinf # URL কে key হিসেবে রাখলে ডুপ্লিকেটগুলো রিপ্লেস হয়ে যাবে
        
    return [(extinf, url) for url, extinf in unique_items.items()]

def check(entry):
    extinf, url = entry
    cmd = [
        "ffprobe", "-user_agent", USER_AGENT, "-v", "error",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1", url
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
        output = r.stdout.strip()
        if r.returncode == 0 and ("video" in output or "audio" in output):
            return True, entry
    except:
        pass
    return False, entry

def save(file, entries):
    with open(file, "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for e, u in entries:
            f.write(e + "\n")
            f.write(u + "\n")

def main():
    if shutil.which("ffprobe") is None:
        print("❌ 'ffprobe' পাওয়া যায়নি!")
        return

    items = load_all_m3u(M3U_SOURCES)
    print(f"\n✅ মোট ইউনিক চ্যানেল পাওয়া গেছে: {len(items)} টি। চেকিং শুরু হচ্ছে...\n")

    ok = []
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futures = [ex.submit(check, x) for x in items]
        total = len(futures)

        for i, future in enumerate(as_completed(futures), 1):
            good, entry = future.result()
            if good:
                ok.append(entry)
                print(f"[{i}/{total}] 🟢 WORKING")
            else:
                print(f"[{i}/{total}] 🔴 DEAD")

    save(WORKING_FILE, ok)
    print(f"\n🎉 সফল! মোট {len(ok)} টি সচল লিংক {WORKING_FILE} ফাইলে সেভ হয়েছে।")

if __name__ == "__main__":
    main()
