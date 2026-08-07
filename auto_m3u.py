import asyncio
import aiohttp
import subprocess
import shutil
import logging
import random
from urllib.parse import urlparse

# --- কনফিগারেশন ---
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
CONCURRENCY_LIMIT = 100  # একসাথে ১০০টি রিকোয়েস্ট (Async এর জন্য এটা নিরাপদ)
HTTP_TIMEOUT = 5         # প্রাথমিক HTTP চেকের জন্য টাইমআউট
FFPROBE_TIMEOUT = 8      # FFprobe এর জন্য টাইমআউট

# রেন্ডম ইউজার-এজেন্ট লিস্ট (বট ব্লকিং এড়াতে)
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
        self.unique_channels = {}
        self.working_channels = []
        self.dead_count = 0
        self.total_playlists = 0

    def get_random_ua(self):
        return random.choice(USER_AGENTS)

    async def fetch_playlist(self, session, url):
        """একটি প্লেলিস্ট ডাউনলোড ও পার্স করা"""
        clean_url = url.split('|')[0]
        headers = {"User-Agent": self.get_random_ua()}
        
        try:
            async with session.get(clean_url, headers=headers, timeout=15) as response:
                if response.status == 200:
                    text = await response.text()
                    lines = text.splitlines()
                    self._parse_m3u_content(lines)
                    self.total_playlists += 1
                    logger.info(f"✅ Loaded: {clean_url}")
                else:
                    logger.warning(f"⚠️ Failed ({response.status}): {clean_url}")
        except Exception as e:
            logger.error(f"❌ Error fetching {clean_url}: {str(e)}")

    def _parse_m3u_content(self, lines):
        """M3U লাইন থেকে ডেটা এক্সট্রাক্ট করা (ডুপ্লিকেট রিমুভ সহ)"""
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if line.startswith("#EXTINF"):
                if i + 1 < len(lines):
                    url = lines[i + 1].strip()
                    if url and not url.startswith("#") and url.startswith("http"):
                        # URL কে key হিসেবে রাখলে অটো ডুপ্লিকেট রিমুভ হবে
                        self.unique_channels[url] = line
                i += 2
            else:
                i += 1

    async def check_channel(self, session, semaphore, url, extinf):
        """একটি চ্যানেলের লিংক চেক করা (HTTP + FFprobe)"""
        async with semaphore:
            headers = {"User-Agent": self.get_random_ua()}
            
            # স্টেপ ১: ফাস্ট HTTP চেক (সার্ভার রেসপন্স করে কি না)
            try:
                # হেড রিকোয়েস্ট অনেক ফাস্ট, পুরো ভিডিও টানে না
                async with session.head(url, headers=headers, timeout=HTTP_TIMEOUT, allow_redirects=True) as resp:
                    if resp.status not in [200, 302, 301]:
                        self.dead_count += 1
                        return
            except Exception:
                # হেড ফেইল করলেও কিছু আইপিটিভি GET এ কাজ করে, তাই সরাসরি ব্লক করছি না
                pass

            # স্টেপ ২: FFprobe দিয়ে স্ট্রিম চেক (শুধুমাত্র যদি HTTP মোটামুটি ঠিক থাকে)
            cmd = [
                "ffprobe", "-user_agent", headers["User-Agent"], "-v", "error",
                "-show_entries", "stream=codec_type",
                "-of", "default=noprint_wrappers=1:nokey=1", url
            ]
            
            try:
                # asyncio.create_subprocess_exec ব্যবহার করে নন-ব্লকিং সাবপ্রসেস রান করা
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=FFPROBE_TIMEOUT)
                    output = stdout.decode('utf-8').strip()
                    
                    if process.returncode == 0 and ("video" in output or "audio" in output):
                        self.working_channels.append((extinf, url))
                        logger.info(f"🟢 OK: {urlparse(url).netloc}...")
                        return
                except asyncio.TimeoutError:
                    process.kill()
                    
            except Exception as e:
                pass

            self.dead_count += 1

    def save_output(self):
        """আউটপুট সেভ করা (ইনফো ডামি চ্যানেল সহ)"""
        logger.info("💾 Saving results to file...")
        with open(WORKING_FILE, "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n")
            
            info_logo = "https://i.ibb.co/VTRJ5vX/info.png"
            group = "ℹ️ INFO & CREDITS"
            online_count = len(self.working_channels)
            
            # ইনফো চ্যানেল তৈরি
             f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", 🟢 Online Channels: {online_count}\nhttp://dummy.link/2\n')
              f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", 👑 Made By All in one reborn\nhttp://dummy.link/4\n')
            f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", ✈️ Telegram: https://t.me/allonebd\nhttp://dummy.link/5\n')
            f.write(f'#EXTINF:-1 tvg-logo="{info_logo}" group-title="{group}", 🌐 Web: https://www.ratulxlive.duckdns.org/\nhttp://dummy.link/6\n')

            # রিয়েল চ্যানেল সেভ
            for extinf, url in self.working_channels:
                f.write(extinf + "\n" + url + "\n")

    async def run(self):
        # FFprobe চেক
        if shutil.which("ffprobe") is None:
            logger.critical("❌ FFprobe not found in system PATH!")
            return

        logger.info("🚀 Starting Enterprise M3U Checker...")

        # ১. প্লেলিস্ট ডাউনলোড পর্ব
        async with aiohttp.ClientSession() as session:
            download_tasks = [self.fetch_playlist(session, url) for url in M3U_SOURCES]
            await asyncio.gather(*download_tasks)

        total_unique = len(self.unique_channels)
        logger.info(f"✅ Found {total_unique} unique channels. Starting validation...")

        # ২. চ্যানেল ভ্যালিডেশন পর্ব
        semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
        
        # aiohttp সেশনের কিছু লিমিট কাস্টমাইজ করা (TCP Connector)
        conn = aiohttp.TCPConnector(limit=CONCURRENCY_LIMIT, ssl=False)
        async with aiohttp.ClientSession(connector=conn) as session:
            check_tasks = []
            for url, extinf in self.unique_channels.items():
                task = asyncio.create_task(self.check_channel(session, semaphore, url, extinf))
                check_tasks.append(task)
            
            # প্রগ্রেস ট্র্যাক করার জন্য tqdm এর বিকল্প হিসেবে লগিং
            chunk_size = 1000
            for i in range(0, len(check_tasks), chunk_size):
                chunk = check_tasks[i:i + chunk_size]
                await asyncio.gather(*chunk)
                logger.info(f"📊 Progress: Checked {min(i + chunk_size, total_unique)} / {total_unique}")

        # ৩. ফাইল সেভ পর্ব
        self.save_output()
        logger.info(f"🎉 Done! Working: {len(self.working_channels)} | Dead: {self.dead_count}")

if __name__ == "__main__":
    # Windows এ ProactorEventLoop এরর ফিক্স
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
    processor = M3UProcessor()
    asyncio.run(processor.run())

