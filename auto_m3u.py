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
    "http://alixbd.com/5055.m3u" #SBOX APK PLAYLISTS 

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
        # URL কে Key হিসেবে ধরে ডেটা স্টোর করা হবে, যাতে ডুপ্লিকেট বাদ পড়ে
        self.unique_channels = {} 
        self.working_channels = []
        self.dead_count = 0

    def get_random_ua(self):
        return random.choice(USER_AGENTS)

    def standardize_extinf(self, line):
        """
        ক্যাটাগরি (group-title) এবং চ্যানেলের নাম ক্লিন করার ফাংশন।
        যাতে "news", "NEWS", "News Tv" সব একই ক্যাটাগরিতে পড়ে।
        """
        # চ্যানেলের নাম বের করা
        parts = line.split(',', 1)
        channel_name = parts[1].strip() if len(parts) > 1 else "Unknown Channel"
        
        # group-title বা ক্যাটাগরি বের করা
        group_match = re.search(r'group-title="([^"]+)"', line, re.IGNORECASE)
        
        if group_match:
            original_group = group_match.group(1)
            # ক্লিন করা: স্পেস কমানো এবং Title Case করা (যেমন: news -> News)
            clean_group = original_group.strip().title()
            
            # কিছু কমন ক্যাটাগরি ফিক্স করা
            if "News" in clean_group: clean_group = "News"
            elif "Sports" in clean_group: clean_group = "Sports"
            elif "Movies" in clean_group: clean_group = "Movies"
            elif "Kids" in clean_group: clean_group = "Kids"
            elif "Music" in clean_group: clean_group = "Music"
            
            new_line = line.replace(f'group-title="{original_group}"', f'group-title="{clean_group}"')
        else:
            # যদি ক্যাটাগরি না থাকে, তবে "Others" ক্যাটাগরিতে ফেলে দেওয়া হবে
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
        """M3U ডেটা থেকে ডুপ্লিকেট লিংক বাদ দিয়ে ক্লিন ডেটা রাখা"""
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if line.startswith("#EXTINF"):
                if i + 1 < len(lines):
                    url = lines[i + 1].strip()
                    if url and not url.startswith("#") and url.startswith("http"):
                        
                        extinf_clean, group, name = self.standardize_extinf(line)
                        channel_data = {
                            "extinf": extinf_clean,
                            "group": group,
                            "name": name,
                            "url": url
                        }
                        
                        # ডুপ্লিকেট URL চেক: যদি আগে থেকেই এই URL থাকে, তবে ভালো ক্যাটাগরি থাকলে আপডেট করবে
                        if url not in self.unique_channels:
                            self.unique_channels[url] = channel_data
                        else:
                            # যদি আগেরটার ক্যাটাগরি Others থাকে এবং নতুনটার স্পেসিফিক ক্যাটাগরি থাকে, তবে রিপ্লেস হবে
                            if self.unique_channels[url]["group"] == "Others" and group != "Others":
                                self.unique_channels[url] = channel_data
                i += 2
            else:
                i += 1

    async def check_channel(self, session, semaphore, channel_data):
        """চ্যানেল সচল আছে কি না তা যাচাই করা (HTTP + FFprobe)"""
        url = channel_data["url"]
        
        async with semaphore:
            headers = {"User-Agent": self.get_random_ua()}
            
            # স্টেপ ১: ফাস্ট HTTP চেক
            try:
                async with session.head(url, headers=headers, timeout=HTTP_TIMEOUT, allow_redirects=True) as resp:
                    if resp.status not in [200, 302, 301]:
                        self.dead_count += 1
                        return
            except Exception:
                pass

            # স্টেপ ২: FFprobe দিয়ে স্ট্রিম চেক
            cmd = [
                "ffprobe", "-user_agent", headers["User-Agent"], "-v", "error",
                "-show_entries", "stream=codec_type",
                "-of", "default=noprint_wrappers=1:nokey=1", url
            ]
            
            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=FFPROBE_TIMEOUT)
                    output = stdout.decode('utf-8').strip()
                    
                    if process.returncode == 0 and ("video" in output or "audio" in output):
                        self.working_channels.append(channel_data)
                        logger.info(f"🟢 OK: [{channel_data['group']}] {channel_data['name']}")
                        return
                except asyncio.TimeoutError:
                    process.kill()
                    
            except Exception:
                pass

            self.dead_count += 1

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

        logger.info("🚀 Starting Pro M3U Checker...")

        # ১. প্লেলিস্ট ডাউনলোড পর্ব
        async with aiohttp.ClientSession() as session:
            download_tasks = [self.fetch_playlist(session, url) for url in M3U_SOURCES]
            await asyncio.gather(*download_tasks)

        total_unique = len(self.unique_channels)
        logger.info(f"✅ Found {total_unique} unique streams. Starting validation...")

        # ২. চ্যানেল ভ্যালিডেশন পর্ব
        semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
        
        conn = aiohttp.TCPConnector(limit=CONCURRENCY_LIMIT, ssl=False)
        async with aiohttp.ClientSession(connector=conn) as session:
            check_tasks = []
            for url, data in self.unique_channels.items():
                task = asyncio.create_task(self.check_channel(session, semaphore, data))
                check_tasks.append(task)
            
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
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
    processor = M3UProcessor()
    asyncio.run(processor.run())

