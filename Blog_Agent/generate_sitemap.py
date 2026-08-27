import os
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Set your actual production domain here (or add it to your .env)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://scholarportal.site")

# Initialize Database
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def create_sitemap():
    print("🗺️ Fetching intelligence reports for sitemap...")
    
    try:
        # Fetch all slugs and creation dates
        response = supabase.table('blog_posts').select('slug, created_at').order('created_at', desc=True).execute()
        posts = response.data
        
        if not posts:
            print("⚠️ No posts found in database.")
            return

        # 1. Start the XML structure
        xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
        xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        
        # 2. Add your static React pages
        static_pages = [
            {'path': '/', 'priority': '1.0', 'freq': 'daily'},
            {'path': '/blog', 'priority': '0.9', 'freq': 'hourly'},
            {'path': '/dashboard', 'priority': '0.8', 'freq': 'weekly'}
        ]
        
        for page in static_pages:
            xml_content += f"""  <url>
    <loc>{FRONTEND_URL}{page['path']}</loc>
    <changefreq>{page['freq']}</changefreq>
    <priority>{page['priority']}</priority>
  </url>\n"""

        # 3. Add the dynamic AI blog posts
        for post in posts:
            slug = post.get('slug')
            # Format date to standard XML format (YYYY-MM-DD)
            date_str = post.get('created_at', '').split('T')[0]
            if not date_str:
                date_str = datetime.now().strftime('%Y-%m-%d')
                
            xml_content += f"""  <url>
    <loc>{FRONTEND_URL}/blog/{slug}</loc>
    <lastmod>{date_str}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n"""

        # Close the XML tag
        xml_content += '</urlset>'

        # 4. Save the file into your React 'public' directory
        # This navigates UP one folder from Blog_Agent, then INTO public
        output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'sitemap.xml')
        
        # Write the file
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(xml_content)
            
        print(f"✅ Sitemap successfully generated at: {os.path.abspath(output_path)}")
        
    except Exception as e:
        print(f"❌ Failed to generate sitemap: {e}")

if __name__ == "__main__":
    create_sitemap()