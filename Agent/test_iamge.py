import os
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
import requests
from bs4 import BeautifulSoup
import urllib.parse
import re

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)
VERIFIED_IMAGES = [
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800"
]
def get_official_image(url: str) -> str:
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            img_url = og_image['content']
            if img_url.startswith('http'):
                return img_url
    except Exception as e:
        print(f"      ⚠️ Failed to scrape official image: {e}")
    return None

def get_ai_generated_image(title: str, country: str) -> str:
    clean_title = re.sub(r'[^a-zA-Z0-9\s]', '', title)
    prompt = f"Professional university campus banner, academic scholarship concept, {clean_title} in {country}, cinematic lighting, photorealistic, no text"
    encoded_prompt = urllib.parse.quote(prompt)
    return f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=800&height=400&nologo=true"

def fetch_and_upload_image(source_url: str, title: str, country: str) -> str:
    """Pipelines the image from source (or AI) to Cloudinary and returns the secure URL."""
    # 1. Try scraping the official image
    target_img_url = get_official_image(source_url)
    source_type = "Official"
    
    # 2. Fallback to AI generation
    if not target_img_url:
        target_img_url = get_ai_generated_image(title, country)
        source_type = "AI-Generated"
        
    try:
        # 3. Upload to Cloudinary directly from the URL
        upload_result = cloudinary.uploader.upload(
            target_img_url,
            folder="scholarships",
            transformation=[
                {"width": 800, "height": 400, "crop": "fill", "gravity": "auto"}
            ]
        )
        print(f"      🖼️ Image secured via {source_type} and uploaded to Cloudinary.")
        return upload_result.get("secure_url")
    except Exception as e:
        print(f"      ⚠️ Cloudinary/AI upload failed: {e}")
        # 4. Absolute fallback: guaranteed high-quality Unsplash image
        fallback_img = random.choice(VERIFIED_IMAGES)
        print("      🔄 Using guaranteed fallback image from VERIFIED_IMAGES.")
        return fallback_img

if __name__ == "__main__":
    print("\n--- Test 1: Scrape Official Image (MIT) ---")
    url1 = fetch_and_upload_image("https://www.mit.edu/", "MIT Engineering Fellowship", "USA")
    print(f"Result URL: {url1}")

    print("\n--- Test 2: Force AI Generation (Fake URL) ---")
    url2 = fetch_and_upload_image("https://example.com/fake-site", "Quantum Physics PhD", "Switzerland")
    print(f"Result URL: {url2}\n")