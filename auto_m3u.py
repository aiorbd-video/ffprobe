import subprocess
import requests
import shutil
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

# এখানে আপনার আনলিমিটেড M3U লিংকগুলো দিন
M3U_SOURCES = [
    # --- Visible & Active Links ---
    "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/refs/heads/main/playlist.m3u",
    "https://playlists-by-playztv.pages.dev/snxt",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/refs/heads/main/distrotv.m3u",
    "https://playlists-by-playztv.pages.dev/disttv-playztv.m3u",
    "https://playlists-by-playztv.pages.dev/zeesd.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/Yupptv-Playlist/refs/heads/main/playlist.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/refs/heads/master/streams/uk_samsung.m3u",
    "https://playlists-by-playztv.pages.dev/lggtv",
    "https://m3u-tvb.pages.dev/myc.M3u",
    "https://playlists-by-playztv.pages.dev/shoqpkk.m3u",
    "https://playztv-ol-pl.deadxploit.workers.dev/?get-pl&id=tapmadpkkonly",
    "https://playztv-ol-pl.deadxploit.workers.dev/?get-pl&id=tmatv-playztv.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/Toffee-playlist/refs/heads/main/NS_player.json",
    "https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update-Playlist/refs/heads/main/toffee_playlist.m3u",
    "https://aynaa.playztv.workers.dev/pl",
    "https://m3u-tvb.pages.dev/Jjago.br.m3u8",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/refs/heads/main/SOFAST.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/refs/heads/main/PlutoTV-All.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/refs/heads/main/Roku-All.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/refs/heads/main/tubi_playlist.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/refs/heads/main/Stirr-All.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/refs/heads/main/xumo_playlist.m3u",
    "https://playlists-by-playztv.pages.dev/epict.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/refs/heads/master/streams/in_doordarshan.m3u",
    "https://playlists-by-playztv.pages.dev/wavesno.m3u",
    "https://playztv-ol-pl.deadxploit.workers.dev/?get-pl&id=pishowxc.m3u",
    "https://iptv-org.github.io/iptv/index.m3u",
    "https://iptv-org.github.io/iptv/languages/hin.m3u",
    "https://playlists-by-playztv.pages.dev/dangalp.m3u",
    "https://playlists-by-playztv.pages.dev/mxp.m3u",
    "https://pzsl.pzcdn.workers.dev/?get-pl",
    "https://raw.githubusercontent.com/SSK4570live/TV-/refs/heads/main/son.m3u",
    "https://raw.githubusercontent.com/SSK4570live/TV-/refs/heads/main/jtv.m3u",
    "https://raw.githubusercontent.com/joiptv/Jo/refs/heads/main/Zoh.txt",
    "https://alex4528.site/playlist/jcinema.m3u",
    "https://alex4528.site/playlist/jstar.m3u",
    "https://alex4528.site/playlist/z5.m3u",
    "https://m3u-tvb.pages.dev/jiobd.m3u",
    "https://playlists-by-playztv.pages.dev/Free-Sports.m3u",
    "https://raw.githubusercontent.com/sm-monirulislam/SM-Live-TV/refs/heads/main/Combined_Live_TV.m3u",
    "https://raw.githubusercontent.com/IPTVFlixBD/OopsTv/refs/heads/main/wc5.m3u",
    "https://raw.githubusercontent.com/IPTVFlixBD/OopsTv/refs/heads/main/asia.m3u",
    "https://playztv-ol-pl.deadxploit.workers.dev/?get-pl&id=zong-tvv.m3u",
    "https://playlists-by-playztv.pages.dev/Izzio.go.m3u",
    "https://raw.githubusercontent.com/alex4528y/m3u/refs/heads/main/jtv.m3u",
    "https://m3u-tvb.pages.dev/Ekek.m3u",
    "https://raw.githubusercontent.com/delmitv/lista-IPTV/refs/heads/main/lista.m3u",
    "https://raw.githubusercontent.com/IPTVFlixBD/OopsTv/refs/heads/main/world-1.m3u",
    "https://m3u-tvb2.pages.dev/portal-playlist.m3u",
    "https://pastebin.com/raw/typGY2Ym",
    "https://ip-tv.app/m3u/Spain_322.m3u",
    "https://raw.githubusercontent.com/Free-TV/IPTV/refs/heads/master/playlists/playlist_spain.m3u8",
    "https://m3u-tvb.pages.dev/dmngo.m3u",
    "https://raw.githubusercontent.com/drmlive/fancode-live-events/refs/heads/main/fancode.m3u",
    "https://raw.githubusercontent.com/srhady/Fancode-bd/refs/heads/main/main_playlist.m3u",
    "https://raw.githubusercontent.com/drmlive/sliv-live-events/refs/heads/main/sonyliv.m3u",
    "https://tiny.cc/Pocket-TV",
    "https://spoo.me/Pocket-m3u",
    "https://raw.githubusercontent.com/doctor-8trange/nexphi0/refs/heads/main/data/icc.m3u",
    "https://raw.githubusercontent.com/srhady/tapmad-bd/refs/heads/main/tapmad_bd.m3u",
    "https://raw.githubusercontent.com/IPTVFlixBD/OopsTv/refs/heads/main/all-sports.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/CricHd-playlists-Auto-Update-permanent/refs/heads/main/ALL.m3u",
    "https://solitary-shadow-cbb3.ekkktb.workers.dev/",
    "https://m3u-tvb.pages.dev/Cg.m3u8",
    "https://m3u-tvb2.pages.dev/asia-2.m3u",
    "https://m3u-tvb2.pages.dev/sf-playlist.m3u",
    "https://raw.githubusercontent.com/lucaswyte/iptv/ae8de55d61b66f29e0f2b0ea05fd0e926c0c4042/vizio.m3u8",
    "https://raw.githubusercontent.com/IPTVFlixBD/OopsTv/refs/heads/main/bd-test.m3u",
    "https://m3u-tvb.pages.dev/ayna+.m3u",
    "https://raw.githubusercontent.com/amin8453/playlist/main/main.m3u",
    "https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/primevideo_sports.m3u",

    # --- Invisible / Broken / Backend Links (JSON-এ visible:false ছিল) ---
    "https://m3u-tvb.pages.dev/akk-iptv.m3u8",
    "https://pastebin.com/raw/3fefFwep",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/refs/heads/main/Moveonjoy.m3u",
    "https://playlists-by-playztv.pages.dev/runnottt.m3u",
    "https://sl.link-etvv.workers.dev/?get-pl",
    "https://raw.githubusercontent.com/alpha4528/m3u/refs/heads/main/suntv.m3u",
    "http://103.161.153.165:8000/playlist.m3u8",
    "https://raw.githubusercontent.com/alex8875/m3u/refs/heads/main/artl.m3u",
    "https://hotstarlive.delta-cloud.workers.dev/?token=240bb9-374e2e-3c13f0-4a7xz5",
    "https://gist.githubusercontent.com/ArcReactorCode/2c28e1e14e6cbb8a0e50bf2065d6d1b5/raw/zee5.m3u",
    "https://jiotv-playlist.pages.dev/freetvindia.m3u",
    "https://playlists-by-playztv.pages.dev/mv.m3uxxx",
    "https://raw.githubusercontent.com/abusaeeidx/iptv-playlist/refs/heads/main/bdnww.m3u",
    "https://prime-tb-playlist.netlify.app/mix.tv.m3u8",
    "https://yt2m3u-autogen.pages.dev/YT-playlist.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/BDxTV/refs/heads/main/full_channels.m3u",
    "https://exteramix.cdn-ssk.workers.dev/",
    "https://raw.githubusercontent.com/quervo/my-playlists/d23aba019704cbefcea3dbf49d1e1244c78b7234/DIRECTV.m3u",
    "https://piratestv.cdn-ssk.workers.dev/",
    "https://playlists-by-playztv.pages.dev/2.0.m3u",
    "https://raw.githubusercontent.com/IPTVFlixBD/OopsTv/refs/heads/main/wc-ch10.m3u",
    "https://sonamul4545.vercel.app/siyam3535.m3u",
    "http://103.229.254.25:7001/playlist.m3u",
    "https://m3u-tvb.pages.dev/playz+.m3u",
    "https://host.cloudplay.me/app/cat/kids247.m3u",
    "https://zioplus.saqlainhaider8198.workers.dev/skstar.m3u",
    "https://raw.githubusercontent.com/sunilprregmi/hera-hai/refs/heads/main/ott_gs.m3u",
    "https://m3u-tvb.pages.dev/mx.m3u",
    "https://codeberg.org/royjaalexa/tees/raw/branch/main/ratv.m3u",
    "https://codeberg.org/royjaalexa/tees/raw/branch/main/wod_go.m3u",
    "https://freelivtv.xyz/dittotv/dittotv.m3u",
    "https://m3u-tvb.pages.dev/1t.m3u8",
    "https://tattistar.vercel.app/jhs.m3u",
    "https://m3u-tvb.pages.dev/BOSS-BDIX.m3u",
    "https://raw.githubusercontent.com/eishakilei-bd08/soha/refs/heads/main/t.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/refs/heads/master/streams/in_tango.m3u",
    "https://m3u-tvb.pages.dev/XOTT_16032026_2107fk.m3u",
    "https://raw.githubusercontent.com/srhady/fifaplus/refs/heads/main/fifa_live.m3u",
    "https://ay2.playztv.workers.dev/?key=plz_lock_2026",
    "https://playztv-ol-pl.deadxploit.workers.dev/?get-pl&id=zenie-tv",
    "https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/live_sports.m3u",
    "https://raw.githubusercontent.com/sunilprregmi/hera-hai/3d5b20bb176b9985b0f55f87d47f6d7b54037142/livetv_tcl_gb.m3u",
    "https://m3u-tvb.pages.dev/world3.m3u",
    "https://m3u-tvb.pages.dev/jiobd3.m3u",
    "https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/refs/heads/main/toffee_OTT_Navigator.m3u",
    "https://m3u-tvb.pages.dev/filexupx1.m3u",
    "https://m3u-tvb2.pages.dev/Mac-ASIA.m3u"
]

WORKING_FILE = "working.m3u"
THREADS = 20  
TIMEOUT = 10
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def load_all_m3u(sources):
    headers = {"User-Agent": USER_AGENT}
    all_items = []
    loaded_playlists = 0
    
    for source in sources:
        print(f"📥 লোড হচ্ছে: {source}")
        try:
            if source.startswith("http"):
                # ইউজার-এজেন্টজনিত সমস্যা এড়াতে | বা অন্য প্যারামিটার বাদ দিয়ে ক্লিন URL নেওয়া হচ্ছে
                clean_url = source.split('|')[0]
                response = requests.get(clean_url, headers=headers, timeout=20)
                text = response.text.splitlines()
            else:
                with open(source, encoding="utf-8", errors="ignore") as f:
                    text = f.readlines()
            
            loaded_playlists += 1
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
            
    # ডুপ্লিকেট লিংক রিমুভ করা
    unique_items = {}
    for extinf, url in all_items:
        unique_items[url] = extinf
        
    return [(extinf, url) for url, extinf in unique_items.items()], loaded_playlists


def check(entry):
    extinf, url = entry
    
    # ডামি বা ইনফো লিংক হলে চেক করার দরকার নেই, সরাসরি পাস করে দেবে
    if "dummy.link" in url:
        return True, entry

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


def save_working_playlist(file, ok_entries, dead_count, playlist_count):
    """এখানে আপনার দেওয়া ক্রেডিট এবং স্ট্যাটাসগুলো ইনফো চ্যানেল হিসেবে তৈরি করা হয়েছে"""
    
    with open(file, "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        
        info_logo = "https://i.ibb.co/VTRJ5vX/info.png"
        group = "ℹ️ INFO & CREDITS"
        online_count = len(ok_entries)
        
        # ১. ইনফো চ্যানেল: Playlists Checked
        f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", 📁 Total Playlist Checked: {playlist_count}\n')
        f.write('http://dummy.link/playlist.mp4\n')
        
        # ২. ইনফো চ্যানেল: Online Channels
        f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", 🟢 Online Channels: {online_count}\n')
        f.write('http://dummy.link/online.mp4\n')
        
        # ৩. ইনফো চ্যানেল: Dead Channels
        f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", 🔴 Dead Channels: {dead_count}\n')
        f.write('http://dummy.link/dead.mp4\n')
        
        # ৪. ইনফো চ্যানেল: Creator Credit
        f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", 👑 Made By All in one reborn\n')
        f.write('http://dummy.link/credit1.mp4\n')
        
        # ৫. ইনফো চ্যানেল: Telegram Link
        f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", ✈️ Join telegram https://t.me/allonebd\n')
        f.write('http://dummy.link/credit2.mp4\n')
        
        # ৬. ইনফো চ্যানেল: Website Link
        f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", 🌐 Website: https://www.ratulxlive.duckdns.org/\n')
        f.write('http://dummy.link/credit3.mp4\n')

        # রিয়েল চ্যানেলগুলো রাইট করা হচ্ছে
        for extinf, url in ok_entries:
            f.write(extinf + "\n")
            f.write(url + "\n")


def main():
    if shutil.which("ffprobe") is None:
        print("❌ 'ffprobe' পাওয়া যায়নি!")
        return

    # লিংক কালেক্ট করা
    items, playlist_count = load_all_m3u(M3U_SOURCES)
    print(f"\n✅ মোট ইউনিক চ্যানেল পাওয়া গেছে: {len(items)} টি। চেকিং শুরু হচ্ছে...\n")

    ok = []
    bad_count = 0

    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futures = [ex.submit(check, x) for x in items]
        total = len(futures)

        for i, future in enumerate(as_completed(futures), 1):
            good, entry = future.result()
            if good:
                ok.append(entry)
                print(f"[{i}/{total}] 🟢 WORKING")
            else:
                bad_count += 1
                print(f"[{i}/{total}] 🔴 DEAD")

    # ফাইল সেভ করা (আপনার দেওয়া স্ট্যাটাস ও ক্রেডিটসহ)
    save_working_playlist(WORKING_FILE, ok, bad_count, playlist_count)
    
    print(f"\n🎉 সফল! মোট {len(ok)} টি সচল লিংক '{WORKING_FILE}' ফাইলে সেভ হয়েছে।")

if __name__ == "__main__":
    main()
