// Curated, stable education imagery for missing or repeatedly assigned covers.
export const ARTICLE_COVERS = [
  'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1519452575417-564c1401ecc0?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&q=82&w=1200',
  'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&q=82&w=1200',
];

const stableNumber = value => {
  let hash = 0;
  for (const char of String(value || 'article')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
};

export function articleFallback(post, position) {
  const key = post?.slug || post?.id || post?.title || 'article';
  const index = Number.isInteger(position) ? position : stableNumber(key);
  return ARTICLE_COVERS[index % ARTICLE_COVERS.length];
}

export function articleCover(post, position, repeated = false) {
  return !repeated && String(post?.image || '').trim()
    ? post.image.trim()
    : articleFallback(post, position);
}
