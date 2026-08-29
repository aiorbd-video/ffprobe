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
M3U_SOURCES = [
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/verse.m3u",
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/criticx.m3u",
    "https://m3u-tvb.pages.dev/ayna+.m3u",
    "http://alixbd.com/2022.m3u",
    "https://raw.githubusercontent.com/aiorbd-video/livxow/refs/heads/main/database/media/rebornmovies/english/marvelstudio/movies.m3u",
]

WORKING_FILE = "working.m3u"
CONCURRENCY_LIMIT = 50  
HTTP_TIMEOUT = 10         
FFPROBE_TIMEOUT = 10      

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "VLC/3.0.18 LibVLC/3.0.18",
    "Kodi/19.5 (Windows NT 10.0; Win64; x64) App_Bitness/64 Version/19.5-Matrix"
]

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
        self.channels_grouped = {} 
        self.working_channels = []
        self.dead_count = 0

    def get_random_ua(self):
        return random.choice(USER_AGENTS)

    def normalize_name(self, name):
        name = name.strip()
        name = re.sub(r'\s+', ' ', name)
        return name.title()

    def standardize_data(self, line, url):
        """ক্যাটাগরি, ভিওডি এবং দেশের নাম ফিক্স করার স্মার্ট ইঞ্জিন"""
        parts = line.split(',', 1)
        channel_name = parts[1].strip() if len(parts) > 1 else "Unknown Channel"
        channel_name_lower = channel_name.lower()
        
        group_match = re.search(r'group-title="([^"]+)"', line, re.IGNORECASE)
        original_group = group_match.group(1).strip() if group_match else "Others"
        group_lower = original_group.lower()
        
        clean_group = original_group.title()

        # URL অ্যানালাইসিস
        url_lower = url.lower()
        parsed_url = urlparse(url_lower)
        url_path = parsed_url.path
        url_host = parsed_url.hostname or ""

        # -------------------------------------------------------------
        # ১. VOD (Video On Demand) চেকার (আপডেটেড)
        # -------------------------------------------------------------
        vod_extensions = ('.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv')
        
        # চেক: এক্সটেনশন, অথবা লিংকের শুরুতে/মাঝে vod, vods, movie, series ইত্যাদি আছে কি না
        is_vod_link = (
            url_path.endswith(vod_extensions) or 
            "://vod" in url_lower or 
            "vod." in url_host or 
            "vods." in url_host or
            "/vod/" in url_path or 
            "/vods/" in url_path or
            "/movie/" in url_path or
            "/series/" in url_path
        )
        
        is_vod_group = "vod" in group_lower or ("movie" in group_lower and not url_path.endswith('.m3u8'))

        if is_vod_link or is_vod_group:
            clean_group = "VOD / Movies"
            
        # -------------------------------------------------------------
        # ২. Force Bangladeshi Channels 
        # -------------------------------------------------------------
        elif any(x in channel_name_lower for x in [
            "somoy", "jamuna", "ekattor", "ntv", "atn", "gtv", "gazi tv", 
            "nagorik", "boishakhi", "channel i", "dbc", "independent", 
            "rtv", "btv", "banglavision", "deepto", "dipto", "maasranga", 
            "mohona", "my tv", "desh tv", "asian tv", "ekushey", "t sports", "toffee"
        ]):
            clean_group = "Bangladesh"

        # -------------------------------------------------------------
        # ৩. Force Indian Channels 
        # -------------------------------------------------------------
        elif any(x in channel_name_lower for x in [
            "star ", "zee ", "colors", "sony ", "sun ", "asianet", 
            "abp ", "ndtv", "republic", "aaj tak", "sports18", "jio ", "jalsha"
        ]):
            clean_group = "India"

        # -------------------------------------------------------------
        # ৪. সাধারণ ক্যাটাগরি ফিক্সিং
        # -------------------------------------------------------------
        else:
            if any(x in group_lower for x in ["bangladesh", "bangladeshi", "bangla", "bd"]):
                clean_group = "Bangladesh"
            elif any(x in group_lower for x in ["india", "indian", "hindi", "in"]):
                clean_group = "India"
            elif any(x in group_lower for x in ["sports", "sport", "cricket", "football", "khela"]):
                clean_group = "Sports"
            elif any(x in group_lower for x in ["news", "khobor", "newz"]):
                clean_group = "News"
            elif any(x in group_lower for x in ["kids", "cartoon", "children"]):
                clean_group = "Kids"
            elif any(x in group_lower for x in ["music", "song", "gaan"]):
                clean_group = "Music"
            elif any(x in group_lower for x in ["religious", "islamic", "quran", "islam"]):
                clean_group = "Religious"
            elif original_group == "Others":
                clean_group = "Others"
            else:
                clean_group = original_group.title()
        
        # নতুন গ্রুপ নাম দিয়ে লাইনটি আপডেট করা
        if group_match:
            new_line = line.replace(f'group-title="{original_group}"', f'group-title="{clean_group}"')
        else:
            new_line = f'{parts[0]} group-title="{clean_group}",{parts[1]}'

        return new_line, clean_group, channel_name

    async def fetch_playlist(self, session, url):
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
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if line.startswith("#EXTINF"):
                if i + 1 < len(lines):
                    url = lines[i + 1].strip()
                    if url and not url.startswith("#") and url.startswith("http"):
                        
                        extinf_clean, group, name = self.standardize_data(line, url)
                        norm_name = self.normalize_name(name)
                        
                        channel_data = {
                            "extinf": extinf_clean,
                            "group": group,
                            "name": norm_name,
                            "url": url
                        }
                        
                        if norm_name not in self.channels_grouped:
                            self.channels_grouped[norm_name] = []
                        
                        if not any(x['url'] == url for x in self.channels_grouped[norm_name]):
                            self.channels_grouped[norm_name].append(channel_data)
                i += 2
            else:
                i += 1

    async def process_channel_group(self, session, semaphore, channel_name, candidates):
        async with semaphore:
            for data in candidates:
                url = data["url"]
                headers = {"User-Agent": self.get_random_ua()}
                
                try:
                    async with session.head(url, headers=headers, timeout=HTTP_TIMEOUT, allow_redirects=True) as resp:
                        if resp.status not in [200, 301, 302]:
                            continue 
                except Exception:
                    pass 

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
                        
                        if process.returncode == 0 and ("video" in output or "audio" in output):
                            self.working_channels.append(data)
                            logger.info(f"🟢 OK: [{data['group']}] {channel_name} (Selected 1 link)")
                            self.dead_count += len(candidates) - 1
                            return 
                    except asyncio.TimeoutError:
                        process.kill()
                except Exception:
                    pass

            self.dead_count += len(candidates)
            logger.info(f"🔴 DEAD: [{candidates[0]['group']}] {channel_name} (All links failed)")

    def save_output(self):
        logger.info("💾 Sorting and saving results to file...")
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

        logger.info("🚀 Starting Pro M3U Checker with Ultimate VOD Separation & BD Channel Fix...")

        async with aiohttp.ClientSession() as session:
            download_tasks = [self.fetch_playlist(session, url) for url in M3U_SOURCES]
            await asyncio.gather(*download_tasks)

        total_unique_names = len(self.channels_grouped)
        logger.info(f"✅ Found {total_unique_names} unique Channels. Starting validation...")

        semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
        
        conn = aiohttp.TCPConnector(limit=CONCURRENCY_LIMIT, ssl=False)
        async with aiohttp.ClientSession(connector=conn) as session:
            check_tasks = []
            
            for name, candidates in self.channels_grouped.items():
                task = asyncio.create_task(self.process_channel_group(session, semaphore, name, candidates))
                check_tasks.append(task)
            
            chunk_size = 1000
            for i in range(0, len(check_tasks), chunk_size):
                chunk = check_tasks[i:i + chunk_size]
                await asyncio.gather(*chunk)
                logger.info(f"📊 Progress: Checked {min(i + chunk_size, total_unique_names)} / {total_unique_names} Channels")

        self.save_output()
        logger.info(f"🎉 Done! Working Channels: {len(self.working_channels)} | Dead/Discarded Links: {self.dead_count}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
    processor = M3UProcessor()
    asyncio.run(processor.run())

