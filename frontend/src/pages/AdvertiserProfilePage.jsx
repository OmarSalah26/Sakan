import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from '../router/Router';
import { 
  User, Briefcase, Home, Star, MapPin, Bed, Calendar, 
  MessageSquare, Phone, ArrowRight, ShieldCheck 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://api.sakan-egy.com' : '/api');

function formatImageUrl(url) {
  if (!url) return null;
  if (typeof url !== 'string') return url;

  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('blob:') || cleanUrl.startsWith('data:')) return cleanUrl;

  cleanUrl = cleanUrl.replace(/^https?:\/\/[^\/]+/, '');

  const apiServer = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://api.sakan-egy.com' : '');

  if (cleanUrl.startsWith('/static/') || cleanUrl.startsWith('/media/')) {
    return `${apiServer}${cleanUrl}`;
  }
  if (cleanUrl.startsWith('static/') || cleanUrl.startsWith('media/')) {
    return `${apiServer}/${cleanUrl}`;
  }
  return url;
}

export default function AdvertiserProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/users/${id}/profile`);
      if (!res.ok) {
        showToast('تعذر تحميل ملف المعلن');
        navigate('/');
        return;
      }
      const data = await res.json();
      setProfile(data);
    } catch {
      showToast('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>جاري تحميل الملف الشخصي للمعلن...</p>
        </div>
      </div>
    );
  }

  if (!profile || !profile.user) return null;

  const { user: advUser, listings = [], ratings_received = [], avg_rating = 0 } = profile;

  return (
    <div className="detail-page-container">
      
      {/* Back link */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem', padding: 0 }}
        >
          <ArrowRight style={{ width: 18, height: 18 }} /> العودة للخلف
        </button>
      </div>

      {/* Header Profile Card */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '3px solid var(--primary-light)' }}>
            {advUser.profile_photo_url ? (
              <img src={formatImageUrl(advUser.profile_photo_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <User style={{ width: 44, height: 44, color: '#64748b' }} />
            )}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-dark)' }}>{advUser.name}</h1>
              {advUser.verified_by_sakan && (
                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ShieldCheck style={{ width: 14, height: 14 }} /> موثق من سكن
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: '#f1f5f9', color: '#334155', padding: '0.25rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                {advUser.account_type === 'broker' ? (
                  <><Briefcase style={{ width: 14, height: 14 }} /> وسيط عقاري</>
                ) : (
                  <><Home style={{ width: 14, height: 14 }} /> مالك مباشر (بدون عمولة)</>
                )}
              </span>

              {advUser.created_at && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar style={{ width: 14, height: 14 }} /> عضو منذ {new Date(advUser.created_at).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>

            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>إجمالي الإعلانات</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 800 }}>{listings.length} إعلان</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>متوسط التقييم العام</span>
                <strong style={{ fontSize: '1.25rem', color: '#f59e0b', fontWeight: 800 }}>
                  {avg_rating ? `${avg_rating.toFixed(1)} ★` : 'لا يوجد'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>تقييمات الطلاب</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--text-dark)', fontWeight: 800 }}>{ratings_received.length} تقييم</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Listings Grid */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          عقارات المعلن المعروضة ({listings.length})
        </h2>

        {listings.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            لا توجد عقارات نشطة حالياً لهذا المعلن.
          </div>
        ) : (
          <div className="listings-grid">
            {listings.map((item) => {
              const coverImage = item.photo_urls && item.photo_urls.length > 0
                ? formatImageUrl(item.photo_urls[0])
                : "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80";

              return (
                <article key={item.id} className="listing-card" onClick={() => navigate(`/listings/${item.id}`)}>
                  <div className="card-img-wrapper">
                    <img className="card-img" src={coverImage} alt={item.title} />
                  </div>
                  <div className="card-content">
                    <div className="card-location"><MapPin style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /> {item.city}، {item.neighborhood}</div>
                    <h2 className="card-title">{item.title}</h2>
                    <div className="card-beds">الأسرة المتاحة: <strong>{item.available_beds}</strong></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Ratings Received */}
      {ratings_received.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            آراء وتقييمات الطلاب المسجلة ({ratings_received.length})
          </h3>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {ratings_received.map((r) => (
              <div key={r.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{"★".repeat(r.star_count) + "☆".repeat(5 - r.star_count)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
                {r.review_text && <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0 }}>{r.review_text}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
