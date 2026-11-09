#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enterprise M3U Master Stream Processor & Health Engine v2.0
- 100% Secret-Gist Driven (Zero Hardcoded Fallbacks)
- Strict Cross-Channel Global URL Deduplication
- Canonical Channel Name Normalization
- Stream Resolution & Quality Detection (4K, 1080p, 720p, SD via FFprobe)
- Best Quality / Lowest Latency Auto Selection
- Multi-Category Playlists Split (working.m3u + bangladesh.m3u, sports.m3u, india.m3u, movies.m3u, news.m3u, others.m3u)
- Telegram & Discord Instant Notification Alerts
- High-Performance Async Probing + FFprobe Validation
"""

import asyncio
import aiohttp
import subprocess
import shutil
import logging
import random
import re
import os
import sys
import time
import requests
from urllib.parse import urlparse

# --- কনফিগারেশন ---
GIST_SOURCES_URL = os.environ.get("GIST_SOURCES_URL")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL")

WORKING_FILE = "working.m3u"
CONCURRENCY_LIMIT = 50       # প্যারালাল চেকিং থ্রেড লিমিট
HTTP_TIMEOUT = 8             # HTTP হেড/গেট টাইমআউট (সেকেন্ড)
FFPROBE_TIMEOUT = 8          # FFprobe ভ্যালিডেশন টাইমআউট (সেকেন্ড)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "VLC/3.0.20 LibVLC/3.0.20",
    "Kodi/20.3 (Windows NT 10.0; Win64; x64) App_Bitness/64 Version/20.3-Nexus"
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("checker.log", mode='w', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("EnterpriseM3U")

def get_random_ua():
    return random.choice(USER_AGENTS)

def clean_canonical_name(raw_name: str) -> str:
    """
    চ্যানেলের নাম থেকে নয়েজ ও ব্যাকআপ ট্যাগ পরিষ্কার করে একটি সিঙ্গেল ক্যানোনিকাল নাম তৈরি করে।
    """
    name = raw_name.strip()
    
    if name.startswith("#http") or name.startswith("http"):
        parts = name.split("/")
        name = parts[-1].replace(".m3u8", "").replace("-", " ")
    
    name = re.sub(r'^\d+([A-Za-z])', r'\1', name)
    name = re.sub(r'^(BD|IN|UK|US|HINDI|BANGLA)[\s:\-_|]+', '', name, flags=re.IGNORECASE)

    noise_patterns = [
        r'\[backup\s*\d*\]', r'\(backup\s*\d*\)', r'backup\s*\d*',
        r'\[\s*\d+p\s*\]', r'\(\s*\d+p\s*\)', r'\b\d{3,4}p\b',
        r'\[\s*fhd\s*\]', r'\(fhd\)', r'\bfhd\b',
        r'\[\s*uhd\s*\]', r'\(uhd\)', r'\buhd\b',
        r'\[\s*4k\s*\]', r'\(4k\)', r'\b4k\b',
        r'\[\s*hd\s*\]', r'\(hd\)', r'\bhd\b',
        r'\[\s*sd\s*\]', r'\(sd\)', r'\bsd\b',
        r'\[\s*hevc\s*\]', r'\(hevc\)', r'\bhevc\b',
        r'\(org\)', r'\[org\]', r'\(low\)', r'\(high\)',
        r'\|\s*vip\s*\|', r'\|\s*premium\s*\|', r'-\s*live\s*',
        r'server\s*\d+', r'stream\s*\d+'
    ]
    for pattern in noise_patterns:
        name = re.sub(pattern, '', name, flags=re.IGNORECASE)

    name = re.sub(r'[\s\-_|]+', ' ', name).strip()
    return name.title() if name else "Unknown Channel"

def format_resolution_tag(width: int, height: int) -> str:
    """উচ্চতা ও প্রস্থ দেখে রেজোলিউশন ট্যাগ তৈরি করে (4K, 1080p, 720p, SD)"""
    if not height or height <= 0:
        return ""
    if height >= 2160 or width >= 3840:
        return "4K"
    elif height >= 1080 or width >= 1900:
        return "1080p"
    elif height >= 720 or width >= 1200:
        return "720p"
    elif height >= 576:
        return "576p"
    elif height >= 480:
        return "480p"
    else:
        return "SD"

def load_sources_from_gist():
    """
    শুধুমাত্র Gist Secret URL থেকে লিংক ফেচ করে। (Zero Fallback)
    """
    if not GIST_SOURCES_URL or not GIST_SOURCES_URL.strip():
        logger.critical("🛑 CRITICAL ERROR: GIST_SOURCES_URL secret is missing!")
        logger.critical("👉 GitHub Repo -> Settings -> Secrets -> Actions এ 'GIST_SOURCES_URL' যুক্ত করুন।")
        sys.exit(1)

    clean_gist_url = GIST_SOURCES_URL.strip()
    logger.info(f"🔐 Fetching dedicated playlist sources from Secret Gist: {clean_gist_url[:40]}...")

    try:
        headers = {"User-Agent": get_random_ua()}
        resp = requests.get(clean_gist_url, headers=headers, timeout=20)
        
        if resp.status_code != 200:
            logger.critical(f"🛑 Gist fetch failed! HTTP Status: {resp.status_code}")
            sys.exit(1)

        lines = resp.text.splitlines()
        sources = [
            line.strip() for line in lines 
            if line.strip() and not line.strip().startswith("#") and line.strip().startswith("http")
        ]

        if not sources:
            logger.critical("🛑 No valid M3U URLs found inside the Secret Gist! Exiting.")
            sys.exit(1)

        logger.info(f"🎯 Successfully loaded {len(sources)} private M3U source feeds from your Gist.")
        return sources

    except Exception as e:
        logger.critical(f"🛑 Fatal Exception while reading Gist: {str(e)}")
        sys.exit(1)

def send_notifications(stats: dict):
    """
    টেলিগ্রাম ও ডিসকর্ড বট দিয়ে রান সম্পন্ন হওয়ার নোটিফিকেশন পাঠায়
    """
    msg_lines = [
        "📺 *M3U Stream Health Check Completed!*",
        f"⏱️ *Duration:* {stats.get('duration', '0s')}",
        f"✅ *Verified Active Channels:* {stats.get('active_count', 0)}",
        f"🗑️ *Discarded/Dead Links:* {stats.get('dead_count', 0)}",
        f"📊 *Total Ingested Links:* {stats.get('total_raw', 0)}",
        f"🌟 *Category Breakdown:*",
    ]
    for cat, count in stats.get('categories', {}).items():
        msg_lines.append(f"  • {cat}: {count}")

    msg_lines.append("\n📁 *Playlists Updated:* `working.m3u` & category files")
    message_text = "\n".join(msg_lines)

    # ১. টেলিগ্রাম নোটিফিকেশন
    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        try:
            tg_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message_text,
                "parse_mode": "Markdown"
            }
            tg_resp = requests.post(tg_url, json=payload, timeout=10)
            if tg_resp.status_code == 200:
                logger.info("📱 Telegram alert notification sent successfully!")
            else:
                logger.warning(f"⚠️ Telegram alert failed (Status {tg_resp.status_code}): {tg_resp.text}")
        except Exception as tg_err:
            logger.warning(f"⚠️ Telegram notification error: {str(tg_err)}")

    # ২. ডিসকর্ড নোটিফিকেশন
    if DISCORD_WEBHOOK_URL:
        try:
            discord_payload = {
                "username": "M3U Stream Monitor",
                "avatar_url": "https://cdn-icons-png.flaticon.com/512/860/860330.png",
                "embeds": [{
                    "title": "📺 M3U Stream Health Check Completed",
                    "color": 3066993, # Emerald green
                    "description": message_text.replace("*", "**"),
                    "footer": {"text": "Enterprise IPTV Stream Engine"}
                }]
            }
            dc_resp = requests.post(DISCORD_WEBHOOK_URL, json=discord_payload, timeout=10)
            if dc_resp.status_code in [200, 204]:
                logger.info("💬 Discord webhook notification sent successfully!")
            else:
                logger.warning(f"⚠️ Discord alert failed (Status {dc_resp.status_code})")
        except Exception as dc_err:
            logger.warning(f"⚠️ Discord notification error: {str(dc_err)}")

class EnterpriseM3UEngine:
    def __init__(self, sources):
        self.sources = sources
        self.channels_grouped = {}      # Canonical Name -> [candidate dicts]
        self.working_channels = []      # Final verified single channels
        self.global_seen_urls = set()   # ক্রস-চ্যানেল ইউনিক ইউআরএল চেকার
        self.total_raw_links = 0
        self.duplicate_urls_discarded = 0
        self.dead_count = 0
        self.start_time = time.time()

    def standardize_data(self, line: str, url: str):
        """ক্যাটাগরি, ভিওডি এবং দেশের নাম ফিক্স করার স্মার্ট ইঞ্জিন"""
        parts = line.split(',', 1)
        raw_channel_name = parts[1].strip() if len(parts) > 1 else "Unknown Channel"
        canonical_name = clean_canonical_name(raw_channel_name)
        channel_name_lower = canonical_name.lower()

        group_match = re.search(r'group-title="([^"]+)"', line, re.IGNORECASE)
        original_group = group_match.group(1).strip() if group_match else "Others"
        group_lower = original_group.lower()

        clean_group = original_group.title()

        url_lower = url.lower()
        parsed_url = urlparse(url_lower)
        url_path = parsed_url.path
        url_host = parsed_url.hostname or ""

        # ১. VOD (Video On Demand) চেকার
        vod_extensions = ('.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv')
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

        # ২. Force Bangladeshi Channels
        elif any(x in channel_name_lower for x in [
            "somoy", "jamuna", "ekattor", "ntv", "atn", "gtv", "gazi tv", 
            "nagorik", "boishakhi", "channel i", "dbc", "independent", 
            "rtv", "btv", "banglavision", "deepto", "dipto", "maasranga", 
            "mohona", "my tv", "desh tv", "asian tv", "ekushey", "t sports", "toffee"
        ]):
            clean_group = "Bangladesh"

        # ৩. Force Indian Channels
        elif any(x in channel_name_lower for x in [
            "star ", "zee ", "colors", "sony ", "sun ", "asianet", 
            "abp ", "ndtv", "republic", "aaj tak", "sports18", "jio ", "jalsha", "dd sports"
        ]):
            clean_group = "India"

        # ৪. সাধারণ ক্যাটাগরি ফিক্সিং
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
            elif original_group.lower() == "others":
                clean_group = "Others"
            else:
                clean_group = original_group.title()

        if group_match:
            new_line = line.replace(f'group-title="{original_group}"', f'group-title="{clean_group}"')
        else:
            new_line = f'{parts[0]} group-title="{clean_group}"'

        header_part = new_line.split(',', 1)[0]
        final_extinf = f"{header_part},{canonical_name}"

        return final_extinf, clean_group, canonical_name

    async def fetch_playlist(self, session, url):
        clean_url = url.split('|')[0].strip()
        headers = {"User-Agent": get_random_ua()}

        try:
            async with session.get(clean_url, headers=headers, timeout=20) as response:
                if response.status == 200:
                    text = await response.text()
                    lines = text.splitlines()
                    self._parse_m3u_content(lines)
                    logger.info(f"✅ Fetched source playlist: {clean_url[:50]}...")
                else:
                    logger.warning(f"⚠️ Source feed returned status {response.status}: {clean_url}")
        except Exception as e:
            logger.error(f"❌ Error downloading source {clean_url}: {str(e)}")

    def _parse_m3u_content(self, lines):
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if line.startswith("#EXTINF"):
                if i + 1 < len(lines):
                    url = lines[i + 1].strip()
                    if url and not url.startswith("#") and url.startswith("http"):
                        self.total_raw_links += 1
                        clean_url = url.split('|')[0].strip()

                        # গ্লোবাল ইউআরএল ডিডুপ্লিকেশন
                        if clean_url in self.global_seen_urls:
                            self.duplicate_urls_discarded += 1
                            i += 2
                            continue

                        self.global_seen_urls.add(clean_url)
                        extinf_clean, group, canonical_name = self.standardize_data(line, url)

                        channel_data = {
                            "extinf": extinf_clean,
                            "group": group,
                            "name": canonical_name,
                            "url": url
                        }

                        if canonical_name not in self.channels_grouped:
                            self.channels_grouped[canonical_name] = []

                        self.channels_grouped[canonical_name].append(channel_data)
                i += 2
            else:
                i += 1

    async def probe_candidate(self, session, candidate):
        """
        দ্বৈত যাচাইকরণ + রেজোলিউশন ও কোয়ালিটি ডিটেকশন:
        ১. HTTP HEAD/GET (Latency & Reachability)
        ২. FFprobe Codec, Width, Height Validation
        """
        url = candidate["url"]
        headers = {"User-Agent": get_random_ua()}
        start_time = time.time()

        # ধাপ ১: এইচটিটিপি চেক
        try:
            async with session.head(url, headers=headers, timeout=HTTP_TIMEOUT, allow_redirects=True) as resp:
                if resp.status not in [200, 206, 301, 302]:
                    async with session.get(url, headers={**headers, "Range": "bytes=0-1024"}, timeout=HTTP_TIMEOUT, allow_redirects=True) as get_resp:
                        if get_resp.status not in [200, 206, 301, 302]:
                            return False, 0, 0, 0, ""
        except Exception:
            return False, 0, 0, 0, ""

        # ধাপ ২: FFprobe স্ট্রিম ভ্যালিডেশন + রেজোলিউশন এক্সট্রাকশন
        cmd = [
            "ffprobe", "-user_agent", headers["User-Agent"], "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_type,width,height",
            "-of", "default=noprint_wrappers=1:nokey=1", url
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=FFPROBE_TIMEOUT)
            output = stdout.decode('utf-8').strip().splitlines()
            latency_ms = int((time.time() - start_time) * 1000)

            # width and height extraction
            width = 0
            height = 0
            has_video = False

            for item in output:
                item = item.strip()
                if item == "video":
                    has_video = True
                elif item.isdigit():
                    val = int(item)
                    if width == 0:
                        width = val
                    elif height == 0:
                        height = val

            # যদি অডিও চ্যানেল বা স্ট্রিম হয়
            if process.returncode == 0:
                res_tag = format_resolution_tag(width, height)
                return True, latency_ms, width, height, res_tag
        except Exception:
            try:
                process.kill()
            except Exception:
                pass

        return False, 0, 0, 0, ""

    async def process_channel_group(self, session, semaphore, canonical_name, candidates):
        """
        প্রতিটি চ্যানেলের সব ওয়ার্কিং লিংক টেস্ট করে সর্বোচ্চ রেজোলিউশন
        ও সর্বনিম্ন লেটেন্সির সেরা লিংকটি স্বয়ংক্রিয়ভাবে বেছে নেয়।
        """
        async with semaphore:
            verified_options = []

            for candidate in candidates:
                is_working, latency_ms, width, height, res_tag = await self.probe_candidate(session, candidate)
                if is_working:
                    # যদি রেজোলিউশন ট্যাগ থাকে, চ্যানেলের নামের সাথে যোগ করা
                    extinf = candidate["extinf"]
                    if res_tag:
                        extinf_parts = extinf.split(',', 1)
                        header = extinf_parts[0]
                        extinf = f'{header},{canonical_name} [{res_tag}]'

                    verified_options.append({
                        **candidate,
                        "extinf": extinf,
                        "latency_ms": latency_ms,
                        "height": height,
                        "width": width,
                        "res_tag": res_tag
                    })

            if verified_options:
                # বেস্ট কোয়ালিটি সর্টিং: সর্বোচ্চ রেজোলিউশন আগে, সমান হলে কম লেটেন্সি আগে
                verified_options.sort(key=lambda x: (-x["height"], x["latency_ms"]))
                best_choice = verified_options[0]

                self.working_channels.append(best_choice)
                self.dead_count += len(candidates) - 1
                res_info = f" [{best_choice['res_tag']}]" if best_choice['res_tag'] else ""
                logger.info(f"🟢 OK: [{best_choice['group']}] {canonical_name}{res_info} ({best_choice['latency_ms']}ms) -> Best link selected")
            else:
                self.dead_count += len(candidates)
                logger.info(f"🔴 DEAD: [{candidates[0]['group']}] {canonical_name} (All {len(candidates)} candidates failed)")

    def save_output(self):
        """
        ১. মাস্টার working.m3u তৈরি করে
        ২. ক্যাটাগরি-ভিত্তিক আলাদা M3U তৈরি করে (bangladesh.m3u, sports.m3u, etc.)
        """
        logger.info("💾 Sorting channels by Group & Canonical Name...")
        sorted_channels = sorted(self.working_channels, key=lambda x: (x["group"], x["name"]))

        m3u_header = '#EXTM3U x-tvg-url="https://raw.githubusercontent.com/aiorbd-video/epg/main/guide.xml"\n'

        # মাস্টার ফাইল
        with open(WORKING_FILE, "w", encoding="utf-8") as f:
            f.write(m3u_header)
            for ch in sorted_channels:
                f.write(ch["extinf"] + "\n")
                f.write(ch["url"] + "\n")

        # ক্যাটাগরি অনুযায়ী ফাইল স্প্লিট
        categories_dir = "playlists"
        os.makedirs(categories_dir, exist_ok=True)

        category_map = {}
        for ch in sorted_channels:
            grp = ch["group"]
            if grp not in category_map:
                category_map[grp] = []
            category_map[grp].append(ch)

        for grp_name, ch_list in category_map.items():
            # ফাইলনেম তৈরি যেমন: Bangladesh -> bangladesh.m3u
            clean_filename = re.sub(r'[^a-zA-Z0-9_\-]', '', grp_name.lower().replace(" ", "_").replace("/", "_")) + ".m3u"
            cat_filepath = os.path.join(categories_dir, clean_filename)
            with open(cat_filepath, "w", encoding="utf-8") as cf:
                cf.write(f'#EXTM3U x-tvg-url="https://raw.githubusercontent.com/aiorbd-video/epg/main/guide.xml"\n')
                for ch in ch_list:
                    cf.write(ch["extinf"] + "\n")
                    cf.write(ch["url"] + "\n")

        logger.info(f"📁 Generated Master playlist: {WORKING_FILE}")
        logger.info(f"📁 Generated {len(category_map)} category playlists inside /{categories_dir}/ directory.")

        return category_map

    async def run(self):
        if shutil.which("ffprobe") is None:
            logger.critical("❌ FFprobe not found in system PATH! Please install ffmpeg.")
            sys.exit(1)

        logger.info("🚀 Starting Enterprise M3U Stream Engine v2.0...")
        logger.info(f"⚙️ Concurrency: {CONCURRENCY_LIMIT} threads | Timeout: {HTTP_TIMEOUT}s")

        async with aiohttp.ClientSession() as session:
            download_tasks = [self.fetch_playlist(session, url) for url in self.sources]
            await asyncio.gather(*download_tasks)

        total_unique_channels = len(self.channels_grouped)
        logger.info(f"📊 Total Raw Streams Ingested: {self.total_raw_links}")
        logger.info(f"🗑️ Duplicate Cross-Channel URLs Discarded: {self.duplicate_urls_discarded}")
        logger.info(f"📺 Unique Canonical Channels Identified: {total_unique_channels}")
        logger.info("⚡ Starting async stream health & resolution validation...")

        semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
        conn = aiohttp.TCPConnector(limit=CONCURRENCY_LIMIT, ssl=False)

        async with aiohttp.ClientSession(connector=conn) as session:
            tasks = [
                self.process_channel_group(session, semaphore, name, candidates)
                for name, candidates in self.channels_grouped.items()
            ]

            chunk_size = 500
            for i in range(0, len(tasks), chunk_size):
                chunk = tasks[i:i + chunk_size]
                await asyncio.gather(*chunk)
                progress_pct = min(100, int(((i + len(chunk)) / total_unique_channels) * 100))
                logger.info(f"📈 Progress: Checked {min(i + chunk_size, total_unique_channels)} / {total_unique_channels} Channels ({progress_pct}%)")

        category_map = self.save_output()

        elapsed_sec = int(time.time() - self.start_time)
        duration_str = f"{elapsed_sec // 60}m {elapsed_sec % 60}s"

        stats = {
            "duration": duration_str,
            "active_count": len(self.working_channels),
            "dead_count": self.dead_count,
            "total_raw": self.total_raw_links,
            "categories": {k: len(v) for k, v in category_map.items()}
        }

        logger.info("==================================================")
        logger.info("🎉 ENTERPRISE RUN COMPLETED SUCCESSFULLY!")
        logger.info(f"⏱️ Duration: {duration_str}")
        logger.info(f"✅ Verified Active Channels: {len(self.working_channels)}")
        logger.info(f"🗑️ Dead/Backup Discarded Links: {self.dead_count}")
        logger.info(f"📁 Output File: {WORKING_FILE} & /playlists/*")
        logger.info("==================================================")

        # নোটিফিকেশন পাঠানো
        send_notifications(stats)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    secret_sources = load_sources_from_gist()
    engine = EnterpriseM3UEngine(secret_sources)
    asyncio.run(engine.run())
