import asyncio
import aiohttp
import subprocess
import shutil
import logging
import random
import re
from urllib.parse import urlparse
import sys

# --- কনফিগারেশন ---
# টেস্ট করার জন্য দুটি নির্ভরযোগ্য M3U প্লেলিস্ট দেওয়া হলো
M3U_SOURCES = [
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/verse.m3u",  #Verse Tv
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/criticx.m3u", #critix tv
    "https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/refs/heads/main/toffee_OTT_Navigator.m3u", #Toffee
    "https://m3u-tvb.pages.dev/ayna+.m3u", #AynaOTT+
    "http://alixbd.com/5055.m3u", #SBOX APK PLAYLISTS 
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/rebornmovies/english/marvelstudio/movies.m3u", #Reborn Premium Movies
    "https://raw.githubusercontent.com/aiorbd-video/BDIX-LIVE/refs/heads/main/main/allinone/log/a18plus.m3u", #Adult 18+ Reborn playlist
    

]

WORKING_FILE = "working.m3u"
CONCURRENCY_LIMIT = 100  # একসাথে ১০০টি রিকোয়েস্ট চেক করবে
HTTP_TIMEOUT = 5         # প্রাথমিক HTTP চেকের জন্য টাইমআউট (সেকেন্ড)
FFPROBE_TIMEOUT = 8      # FFprobe এর জন্য টাইমআউট (সেকেন্ড)

# সার্ভার বাইপাস করার জন্য রেন্ডম ইউজার-এজেন্ট
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "VLC/3.0.18 LibVLC/3.0.18",
    "Kodi/19.5 (Windows NT 10.0; Win64; x64) App_Bitness/64 Version/19.5-Matrix"
]

# --- লগিং সেটআপ ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("checker.log", mode='w', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class M3UProcessor:
    def __init__(self):
        # চ্যানেলের নাম অনুযায়ী লিংকগুলো গ্রুপ করা হবে
        self.channels_grouped = {} 
        self.working_channels = []
        self.dead_count = 0

    def get_random_ua(self):
        return random.choice(USER_AGENTS)

    def normalize_name(self, name):
        """চ্যানেলের নাম ক্লিন করে স্ট্যান্ডার্ডাইজ করা (যেমন: SOMOY TV -> Somoy Tv)"""
        name = name.strip()
        name = re.sub(r'\s+', ' ', name) # ডাবল স্পেস রিমুভ
        return name.title()

    def standardize_extinf(self, line):
        """ক্যাটাগরি (group-title) এবং চ্যানেলের নাম ক্লিন করার ফাংশন"""
        parts = line.split(',', 1)
        channel_name = parts[1].strip() if len(parts) > 1 else "Unknown Channel"
        
        group_match = re.search(r'group-title="([^"]+)"', line, re.IGNORECASE)
        
        if group_match:
            original_group = group_match.group(1)
            clean_group = original_group.strip().title()
            
            # কিছু কমন ক্যাটাগরি ফিক্স করা
            if "News" in clean_group: clean_group = "News"
            elif "Sports" in clean_group: clean_group = "Sports"
            elif "Movies" in clean_group: clean_group = "Movies"
            elif "Kids" in clean_group: clean_group = "Kids"
            elif "Music" in clean_group: clean_group = "Music"
            
            new_line = line.replace(f'group-title="{original_group}"', f'group-title="{clean_group}"')
        else:
            clean_group = "Others"
            if len(parts) == 2:
                new_line = f'{parts[0]} group-title="{clean_group}",{parts[1]}'
            else:
                new_line = line

        return new_line, clean_group, channel_name

    async def fetch_playlist(self, session, url):
        """প্লেলিস্ট ডাউনলোড এবং ডেটা পার্স করা"""
        clean_url = url.split('|')[0]
        headers = {"User-Agent": self.get_random_ua()}
        
        try:
            async with session.get(clean_url, headers=headers, timeout=15) as response:
                if response.status == 200:
                    text = await response.text()
                    lines = text.splitlines()
                    self._parse_m3u_content(lines)
                    logger.info(f"✅ Loaded: {clean_url}")
                else:
                    logger.warning(f"⚠️ Failed ({response.status}): {clean_url}")
        except Exception as e:
            logger.error(f"❌ Error fetching {clean_url}: {str(e)}")

    def _parse_m3u_content(self, lines):
        """M3U ডেটা থেকে চ্যানেলের নাম অনুযায়ী লিংক গ্রুপ করা"""
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if line.startswith("#EXTINF"):
                if i + 1 < len(lines):
                    url = lines[i + 1].strip()
                    if url and not url.startswith("#") and url.startswith("http"):
                        
                        extinf_clean, group, name = self.standardize_extinf(line)
                        norm_name = self.normalize_name(name) # ক্লিন করা নাম
                        
                        channel_data = {
                            "extinf": extinf_clean,
                            "group": group,
                            "name": norm_name,
                            "url": url
                        }
                        
                        if norm_name not in self.channels_grouped:
                            self.channels_grouped[norm_name] = []
                        
                        # একই চ্যানেলের ভেতরে একই URL যেন দুইবার না ঢোকে
                        if not any(x['url'] == url for x in self.channels_grouped[norm_name]):
                            self.channels_grouped[norm_name].append(channel_data)
                i += 2
            else:
                i += 1

    async def process_channel_group(self, session, semaphore, channel_name, candidates):
        """একটি চ্যানেলের সব লিংক চেক করা এবং সচল পাওয়া মাত্রই বাকিগুলো বাদ দেওয়া"""
        async with semaphore:
            for data in candidates:
                url = data["url"]
                headers = {"User-Agent": self.get_random_ua()}
                
                # স্টেপ ১: ফাস্ট HTTP চেক
                try:
                    async with session.head(url, headers=headers, timeout=HTTP_TIMEOUT, allow_redirects=True) as resp:
                        if resp.status not in [200, 301, 302]:
                            continue # এই লিংক ডেড, পরের লিংকে যাও
                except Exception:
                    pass # হেড ফেইল হলেও FFprobe দিয়ে ট্রাই করব

                # স্টেপ ২: FFprobe দিয়ে স্ট্রিম চেক
                cmd = [
                    "ffprobe", "-user_agent", headers["User-Agent"], "-v", "error",
                    "-show_entries", "stream=codec_type",
                    "-of", "default=noprint_wrappers=1:nokey=1", url
                ]
                
                try:
                    process = await asyncio.create_subprocess_exec(
                        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                    )
                    try:
                        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=FFPROBE_TIMEOUT)
                        output = stdout.decode('utf-8').strip()
                        
                        # যদি লিংক সচল হয়, তবে এটি লিস্টে অ্যাড করো এবং এই চ্যানেলের বাকি লিংকগুলো চেক করা বন্ধ করো
                        if process.returncode == 0 and ("video" in output or "audio" in output):
                            self.working_channels.append(data)
                            logger.info(f"🟢 OK: [{data['group']}] {channel_name} (Selected 1 working link from {len(candidates)} links)")
                            
                            # বাকি যে কয়টা লিংক চেক করা হলো না, সেগুলোকে ডেড হিসেবে কাউন্ট করো
                            self.dead_count += len(candidates) - 1
                            return 
                    except asyncio.TimeoutError:
                        process.kill()
                except Exception:
                    pass

            # যদি লুপ শেষ হয়ে যায় তার মানে কোনো লিংকই কাজ করেনি
            self.dead_count += len(candidates)
            logger.info(f"🔴 DEAD: [{candidates[0]['group']}] {channel_name} (All {len(candidates)} links failed)")

    def save_output(self):
        """ফাইনাল রেজাল্ট সাজিয়ে (Sorting) সেভ করা"""
        logger.info("💾 Sorting and saving results to file...")
        
        # ক্যাটাগরি (group) এবং চ্যানেলের নাম (name) অনুযায়ী A-Z সাজানো হচ্ছে
        sorted_channels = sorted(self.working_channels, key=lambda x: (x["group"], x["name"]))
        
        with open(WORKING_FILE, "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n")
            
            for ch in sorted_channels:
                f.write(ch["extinf"] + "\n")
                f.write(ch["url"] + "\n")

    async def run(self):
        if shutil.which("ffprobe") is None:
            logger.critical("❌ FFprobe not found in system PATH!")
            return

        logger.info("🚀 Starting Pro M3U Checker with Smart De-Duplication...")

        # ১. প্লেলিস্ট ডাউনলোড পর্ব
        async with aiohttp.ClientSession() as session:
            download_tasks = [self.fetch_playlist(session, url) for url in M3U_SOURCES]
            await asyncio.gather(*download_tasks)

        total_unique_names = len(self.channels_grouped)
        logger.info(f"✅ Found {total_unique_names} unique Channels. Starting validation...")

        # ২. চ্যানেল ভ্যালিডেশন পর্ব
        semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
        
        conn = aiohttp.TCPConnector(limit=CONCURRENCY_LIMIT, ssl=False)
        async with aiohttp.ClientSession(connector=conn) as session:
            check_tasks = []
            
            # প্রত্যেকটি ইউনিক চ্যানেলের জন্য টাস্ক ক্রিয়েট করা হচ্ছে
            for name, candidates in self.channels_grouped.items():
                task = asyncio.create_task(self.process_channel_group(session, semaphore, name, candidates))
                check_tasks.append(task)
            
            chunk_size = 1000
            for i in range(0, len(check_tasks), chunk_size):
                chunk = check_tasks[i:i + chunk_size]
                await asyncio.gather(*chunk)
                logger.info(f"📊 Progress: Checked {min(i + chunk_size, total_unique_names)} / {total_unique_names} Channels")

        # ৩. ফাইল সেভ পর্ব
        self.save_output()
        logger.info(f"🎉 Done! Working Channels: {len(self.working_channels)} | Dead/Discarded Links: {self.dead_count}")

if __name__ == "__main__":
    # Windows এ ProactorEventLoop এরর ফিক্স
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
    processor = M3UProcessor()
    asyncio.run(processor.run())
