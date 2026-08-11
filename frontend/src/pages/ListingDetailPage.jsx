import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from '../router/Router';
import { 
  MapPin, Bed, FileText, Shield, Zap, Plug, Share2, 
  User, Briefcase, Home, Star, MessageSquare, Phone, 
  Calendar, PenTool, Send, AlertTriangle, ArrowRight, Check, CheckCircle, Copy,
  ChevronLeft, ChevronRight, Play, ShieldCheck, Wind
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://api.sakan-egy.com' : '/api');

function formatImageUrl(url) {
  if (!url) return "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80";
  if (typeof url !== 'string') return url;

  let cleanUrl = url.trim();
  cleanUrl = cleanUrl.replace(/^http:\/\/(127\.0\.0\.1|localhost):(8000|3000)/, '');

  const apiServer = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://api.sakan-egy.com' : '');

  if (cleanUrl.startsWith('/static/') || cleanUrl.startsWith('/media/')) {
    return `${apiServer}${cleanUrl}`;
  }
  if (cleanUrl.startsWith('static/') || cleanUrl.startsWith('media/')) {
    return `${apiServer}/${cleanUrl}`;
  }
  return cleanUrl;
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays <= 10) return `منذ ${diffDays} أيام`;
  return `منذ ${diffDays} يوماً`;
}

function extractAmenityName(amenity) {
  if (!amenity) return '';
  if (typeof amenity === 'object' && amenity !== null) {
    return amenity.name || amenity.title || amenity.label || '';
  }
  if (typeof amenity === 'string') {
    const trimmed = amenity.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      const match = trimmed.match(/'name':\s*'([^']+)'/) || trimmed.match(/"name":\s*"([^"]+)"/);
      if (match && match[1]) return match[1];
    }
    return trimmed;
  }
  return String(amenity);
}

const INDOOR_AMENITIES = [
  "واي فاي مجاني", "تكييف", "مراوح", "سخان مياه", "ثلاجة", 
  "غسالة", "بوتاجاز / ميكروويف", "فلتر مياه", "سرير إضافي", "مكتب للمذاكرة", "دولاب ملابس"
];

const OUTDOOR_AMENITIES = [
  "قريب من الجامعة", "قريب من المواصلات العامة", "سوبر ماركت", 
  "مطاعم", "كافيهات", "صيدلية", "عيادة طبية", "جيم (Gym)", "ماكينة صراف آلي (ATM)"
];

export function formatShareText(listing) {
  if (!listing) return '';
  const genderStr = listing.gender === 'male' ? 'طلاب (شباب)' : 'طالبات (بنات)';
  
  const configs = listing.room_configurations || [];
  let totalBeds = 0;
  let servicesInclusive = false;
  let hasInsurance = false;
  let insuranceAmount = null;

  if (Array.isArray(configs)) {
    configs.forEach(c => {
      const roomType = c.room_type || 'single';
      const bedCount = roomType === 'single' ? 1 : roomType === 'double' ? 2 : roomType === 'triple' ? 3 : 4;
      const count = c.count || 1;
      totalBeds += bedCount * count;
      if (c.services_inclusive) servicesInclusive = true;
      if (c.insurance_price) {
        hasInsurance = true;
        insuranceAmount = c.insurance_price;
      }
    });
  }

  if (totalBeds === 0) {
    totalBeds = listing.available_beds || 1;
  }

  const availStr = `${listing.available_beds} سرير متاح من أصل ${totalBeds}`;
  let depositStr = 'بدون تأمين';
  if (hasInsurance && insuranceAmount) {
    depositStr = `تأمين: ${insuranceAmount} ج.م`;
  } else if (hasInsurance) {
    depositStr = 'يوجد تأمين';
  }

  const servicesStr = servicesInclusive ? 'شامل الخدمات' : 'الخدمات غير مشمولة';
  const priceStr = listing.price_per_person ? `السعر: ${listing.price_per_person} ج.م / شهرياً` : '';
  const locationParts = [listing.governorate, listing.city, listing.neighborhood].filter(Boolean);
  const locationStr = locationParts.join('، ');

  const lines = [
    `${listing.title} - ${genderStr}`,
    locationStr,
    availStr,
    depositStr,
    servicesStr,
  ];
  if (priceStr) lines.push(priceStr);

  lines.push('');
  lines.push('شاهد التفاصيل الكاملة والأسعار على سكن:');
  lines.push(`https://sakan-egy.com/listings/${listing.id}`);

  return lines.join('\n');
}

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [detailRatingTab, setDetailRatingTab] = useState('property');
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [ratingInput, setRatingInput] = useState({ star_count: 5, review_text: '', photo_urls: [] });
  const [complaintInput, setComplaintInput] = useState({ violation_type: 'السعر المطلوب أعلى من المعلن', description: '', evidence_urls: [] });

  useEffect(() => {
    fetchListingDetail();
  }, [id]);

  useEffect(() => {
    if (data && data.listing) {
      const l = data.listing;
      const genderStr = l.gender === 'male' ? 'طلاب (شباب)' : 'طالبات (بنات)';
      const pageTitle = `${l.title} - ${genderStr} | سكن Sakan`;
      document.title = pageTitle;

      const setMeta = (propName, content) => {
        let el = document.querySelector(`meta[property="${propName}"]`) || document.querySelector(`meta[name="${propName}"]`);
        if (!el) {
          el = document.createElement('meta');
          if (propName.startsWith('og:')) el.setAttribute('property', propName);
          else el.setAttribute('name', propName);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      };

      const shareDesc = formatShareText(l);
      const coverPhoto = l.photo_urls?.[0] ? formatImageUrl(l.photo_urls[0]) : "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80";

      setMeta('og:title', `${l.title} - ${genderStr}`);
      setMeta('og:description', shareDesc);
      setMeta('og:image', coverPhoto);
      setMeta('og:url', `https://sakan-egy.com/listings/${l.id}`);
      setMeta('twitter:title', `${l.title} - ${genderStr}`);
      setMeta('twitter:description', shareDesc);
      setMeta('twitter:image', coverPhoto);
      setMeta('twitter:card', 'summary_large_image');
    }
  }, [data]);

  const fetchListingDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/listings/${id}`);
      if (!res.ok) {
        showToast('تعذر تحميل تفاصيل العقار السكني');
        navigate('/');
        return;
      }
      const json = await res.json();
      setData(json);
      fetch(`${API_BASE}/listings/${id}/view`, { method: 'POST' }).catch(() => {});
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
          <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>جاري تحميل تفاصيل السكن...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.listing) return null;

  const { listing, advertiser, property_ratings = [], advertiser_ratings = [] } = data;
  const allMedia = [...(listing.photo_urls || []), ...(listing.video_urls || [])];
  const isNormalUser = !user || user.account_type === 'student';

  const handleShare = async () => {
    const shareText = formatShareText(listing);
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing.title,
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        showToast('تم نسخ رابط وتفاصيل الإعلان بنجاح!');
      } catch {
        showToast('تعذر نسخ النص تلقائياً');
      }
    }
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('يرجى تسجيل الدخول أولاً لإضافة تقييم');
      navigate('/?auth=login');
      return;
    }
    const targetType = detailRatingTab === 'property' ? 'property' : 'advertiser';
    if (targetType === 'advertiser' && ratingInput.review_text.length < 20) {
      showToast('تعليق تقييم المعلن يجب ألا يقل عن ٢٠ حرفاً');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/ratings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listing.id,
          student_id: user.id,
          target_type: targetType,
          star_count: ratingInput.star_count,
          review_text: ratingInput.review_text,
          photo_urls: ratingInput.photo_urls
        })
      });
      if (res.ok) {
        showToast('تم إرسال تقييمك بنجاح');
        setShowRatingForm(false);
        setRatingInput({ star_count: 5, review_text: '', photo_urls: [] });
        fetchListingDetail();
      } else {
        const err = await res.json();
        showToast(err.detail || 'فشل إرسال التقييم');
      }
    } catch {
      showToast('خطأ في شبكة الاتصال');
    }
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('يرجى تسجيل الدخول أولاً لتقديم بلاغ');
      navigate('/?auth=login');
      return;
    }
    if (complaintInput.description.length < 20) {
      showToast('تفاصيل الشكوى يجب ألا تقل عن ٢٠ حرفاً');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listing.id,
          student_id: user.id,
          violation_type: complaintInput.violation_type,
          description: complaintInput.description,
          evidence_urls: complaintInput.evidence_urls
        })
      });
      if (res.ok) {
        showToast('تم إرسال البلاغ لمشرفي المنصة للتحقيق');
        setShowComplaintForm(false);
        setComplaintInput({ violation_type: 'السعر المطلوب أعلى من المعلن', description: '', evidence_urls: [] });
      } else {
        const err = await res.json();
        showToast(err.detail || 'فشل إرسال البلاغ');
      }
    } catch {
      showToast('خطأ في شبكة الاتصال');
    }
  };

  const hasCoords = listing.latitude != null && listing.longitude != null;
  const googleMapsLink = hasCoords
    ? `https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`
    : `https://www.google.com/maps/search/${encodeURIComponent(listing.address || listing.city)}`;

  return (
    <div className="detail-page-container">
      
      {/* ─── Top Bar: Breadcrumb & Actions ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <button 
            onClick={() => navigate('/')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem', padding: 0 }}
          >
            <ArrowRight style={{ width: 18, height: 18 }} /> العودة للرئيسية
          </button>
          <span>/</span>
          <span>{listing.governorate}</span>
          <span>/</span>
          <span>{listing.city}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {!user && (
            <>
              <button 
                onClick={() => navigate('/?auth=login')}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', fontWeight: 600 }}
              >
                تسجيل الدخول
              </button>
              <button 
                onClick={() => navigate('/?auth=register')}
                className="btn-outline"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', fontWeight: 600 }}
              >
                إنشاء حساب
              </button>
            </>
          )}

          {((user && (user.id === listing.advertiser_id || user.account_type === 'admin')) || listing.full_edit_available || listing.edit_token) && (
            <button 
              onClick={() => {
                window.location.href = `/#/?edit=${listing.id}`;
              }}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <PenTool style={{ width: 16, height: 16 }} /> تعديل الإعلان
            </button>
          )}

          <button 
            onClick={handleShare}
            className="btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          >
            <Share2 style={{ width: 16, height: 16 }} /> مشاركة السكن
          </button>
        </div>
      </div>

      {/* ─── Hero Gallery Section ─── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <div className="detail-gallery-height">
          {allMedia.length > 0 ? (
            carouselIndex < (listing.photo_urls?.length || 0) ? (
              <img 
                src={formatImageUrl(listing.photo_urls[carouselIndex])} 
                alt={listing.title} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <video 
                src={formatImageUrl(listing.video_urls[carouselIndex - (listing.photo_urls?.length || 0)])} 
                controls 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )
          ) : (
            <img 
              src="https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80" 
              alt="placeholder" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          {/* Controls with Lucide icons */}
          {allMedia.length > 1 && (
            <>
              <button 
                onClick={() => setCarouselIndex(prev => prev === 0 ? allMedia.length - 1 : prev - 1)}
                style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight style={{ width: 22, height: 22 }} />
              </button>
              <button 
                onClick={() => setCarouselIndex(prev => prev === allMedia.length - 1 ? 0 : prev + 1)}
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft style={{ width: 22, height: 22 }} />
              </button>
            </>
          )}

          <span style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
            {carouselIndex + 1} / {allMedia.length || 1} وسائط
          </span>
        </div>

        {/* Thumbnails strip */}
        {allMedia.length > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', overflowX: 'auto', background: '#f8fafc', borderTop: '1px solid var(--border)' }}>
            {listing.photo_urls?.map((photo, idx) => (
              <button 
                key={`photo-${idx}`}
                onClick={() => setCarouselIndex(idx)}
                style={{ border: carouselIndex === idx ? '2px solid var(--primary)' : '2px solid transparent', borderRadius: '8px', overflow: 'hidden', padding: 0, cursor: 'pointer', flexShrink: 0, width: '70px', height: '50px' }}
              >
                <img src={formatImageUrl(photo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
            {listing.video_urls?.map((video, idx) => {
              const globalIdx = (listing.photo_urls?.length || 0) + idx;
              return (
                <button 
                  key={`video-${idx}`}
                  onClick={() => setCarouselIndex(globalIdx)}
                  style={{ border: carouselIndex === globalIdx ? '2px solid var(--primary)' : '2px solid transparent', borderRadius: '8px', overflow: 'hidden', padding: 0, cursor: 'pointer', flexShrink: 0, width: '70px', height: '50px', position: 'relative', background: '#000' }}
                >
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <Play style={{ width: 20, height: 20, fill: '#fff' }} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Title & Quick Stats Section ─── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`badge-gender ${listing.gender === 'male' ? 'gender-male' : 'gender-female'}`} style={{ position: 'static' }}>
            {listing.gender === 'male' ? 'طلاب (شباب)' : 'طالبات (بنات)'}
          </span>
          {listing.tier === 'premium' && (
            <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              <Star style={{ width: 14, height: 14, color: '#f59e0b', fill: '#f59e0b' }} /> إعلان مميز
            </span>
          )}
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-dark)', margin: '0.25rem 0 0.5rem' }}>{listing.title}</h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
          <MapPin style={{ width: 18, height: 18, color: 'var(--primary)' }} />
          {listing.governorate}، {listing.city}، {listing.neighborhood}
        </p>

        {/* Quick Stats Pill Row */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <div style={{ background: '#f1f5f9', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Bed style={{ width: 16, height: 16, color: 'var(--primary)' }} />
            {listing.available_beds} أسرة متاحة
          </div>

          {listing.min_lease_months && (
            <div style={{ background: '#f1f5f9', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar style={{ width: 16, height: 16, color: 'var(--primary)' }} />
              حد أدنى للإيجار: {listing.min_lease_months} أشهر
            </div>
          )}

          {listing.floor && (
            <div style={{ background: '#f1f5f9', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Home style={{ width: 16, height: 16, color: 'var(--primary)' }} />
              الدور: {listing.floor}
            </div>
          )}

          {listing.created_at && (
            <div style={{ background: '#f1f5f9', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar style={{ width: 16, height: 16, color: 'var(--primary)' }} />
              نُشر {getTimeAgo(listing.created_at)}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Body: 2 Column Grid ─── */}
      <div className="detail-grid-layout">
        
        {/* LEFT COLUMN (60%): Rooms, Address, Map, Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Room Configurations */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              فئات الغرف والأسعار المتاحة
            </h3>
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {listing.room_configurations?.map((c, idx) => (
                <div key={idx} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                      {c.room_type === 'single' ? 'غرفة فردية' : c.room_type === 'double' ? 'غرفة ثنائية' : c.room_type === 'triple' ? 'غرفة ثلاثية' : 'غرفة رباعية'} ({c.count || 1} غرفة متوفرة)
                    </span>
                    <strong style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                      {c.price_per_person} ج.م <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ شهرياً</span>
                    </strong>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {(c.commission_type === 'range' || (c.commission_min && c.commission_max)) ? (
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
                        عمولة: {c.commission_min} - {c.commission_max} ج.م (تفاوضي)
                      </span>
                    ) : c.commission != null ? (
                      <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}>
                        عمولة: {c.commission} ج.م
                      </span>
                    ) : null}

                    {c.has_ac && (
                      <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Wind style={{ width: 13, height: 13 }} /> ❄️ مكيفة
                      </span>
                    )}

                    {c.insurance_price ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Shield style={{ width: 13, height: 13 }} /> تأمين: {c.insurance_price} ج.م
                      </span>
                    ) : (
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}>
                        بدون تأمين
                      </span>
                    )}
                    {c.services_inclusive ? (
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Zap style={{ width: 13, height: 13 }} /> شامل الخدمات (مياه/كهرباء/إنترنت)
                      </span>
                    ) : (
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Plug style={{ width: 13, height: 13 }} /> الخدمات غير مشمولة
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Address */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              العنوان بالتفصيل
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.95rem' }}>{listing.address}</span>
              <button 
                onClick={() => { navigator.clipboard.writeText(listing.address); showToast('تم نسخ العنوان'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600, fontSize: '0.8rem' }}
              >
                <Copy style={{ width: 14, height: 14 }} /> نسخ
              </button>
            </div>

            {/* Embedded Google Map (only rendered if precise coordinates exist) */}
            {hasCoords && (listing.location_precise || listing.location_precise === undefined) && (() => {
              const { latitude, longitude } = listing;
              const gmSrc = `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
              const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude-0.006},${latitude-0.004},${longitude+0.006},${latitude+0.004}&layer=mapnik&marker=${latitude},${longitude}`;
              return (
                <div style={{ marginTop: '1rem', width: '100%', height: '228px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                  <iframe
                    key={gmSrc}
                    src={gmSrc}
                    width="100%"
                    height={195}
                    style={{ border: 0, display: 'block', flex: '0 0 195px' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Listing Location Map"
                    onError={(e) => { e.target.src = osmSrc; }}
                  />
                  <div style={{ height: '33px', flex: '0 0 33px', background: '#f8fafc', fontSize: '0.8rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
                    <a href={googleMapsLink} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      فتح الموقع في خرائط جوجل <MapPin style={{ width: 14, height: 14 }} />
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Description */}
          {listing.description && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                وصف السكن
              </h3>
              <p style={{ whiteSpace: 'pre-line', color: '#475569', lineHeight: 1.7, fontSize: '0.95rem', margin: 0 }}>
                {listing.description}
              </p>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN (40%): Sticky Advertiser Card & CTAs */}
        <div>
          <div className="detail-sidebar-sticky" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              معلومات المعلن والتواصل
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {advertiser.profile_photo_url ? (
                  <img src={formatImageUrl(advertiser.profile_photo_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User style={{ width: 28, height: 28, color: '#64748b' }} />
                )}
              </div>

              <div>
                <h4 style={{ fontWeight: 700, fontSize: '1.05rem', margin: '0 0 0.25rem' }}>{advertiser.name}</h4>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#334155', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                    {advertiser.account_type === 'broker' ? 'وسيط عقاري' : 'مالك مباشر'}
                  </span>
                  {advertiser.verified_by_sakan && (
                    <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <ShieldCheck style={{ width: 13, height: 13 }} /> موثق
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                  <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>★</span>
                  <strong style={{ fontSize: '0.85rem' }}>{advertiser.avg_rating ? advertiser.avg_rating.toFixed(1) : 'جديد'}</strong>
                </div>
              </div>
            </div>

            {/* View Full Profile Link */}
            <Link 
              to={`/users/${advertiser.id}`} 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', background: '#f8fafc', border: '1px solid var(--border)', padding: '0.55rem', borderRadius: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1.25rem' }}
            >
              <User style={{ width: 14, height: 14 }} /> عرض الملف الشخصي للمعلن
            </Link>

            {/* WhatsApp Note */}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.4rem', marginTop: '0.75rem' }}>
              يرجى إبقاء رسالة سكن الآلية للإيضاح للمعلن أي سكن تقصد.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a 
                href={`https://wa.me/2${(listing.contact_phone || advertiser.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`سلام عليكم أستاذ ${advertiser.name || ''}، شفت إعلان السكن "${listing.title}" في ${listing.governorate}، ${listing.city} على منصة سكن ومحتاج أستفسر عن التفاصيل.`)}`}
                target="_blank" 
                rel="noreferrer"
                style={{ background: '#22c55e', color: '#fff', textDecoration: 'none', padding: '0.75rem', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.95rem' }}
              >
                <MessageSquare style={{ width: 18, height: 18 }} /> تواصل عبر الواتساب
              </a>

              <a 
                href={`tel:${listing.contact_phone || advertiser.phone}`}
                style={{ background: 'var(--bg-muted)', color: '#334155', border: '1px solid var(--border)', textDecoration: 'none', padding: '0.75rem', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.95rem' }}
              >
                <Phone style={{ width: 18, height: 18 }} /> اتصال هاتفي ({listing.contact_phone || advertiser.phone})
              </a>
            </div>

            {/* Short Student Tips: قبل ما تتواصل */}
            <details style={{ marginTop: '1rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
              <summary style={{ fontWeight: 800, color: 'var(--primary)', cursor: 'pointer', fontSize: '0.875rem' }}>
                قبل ما تتواصل
              </summary>
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#334155', lineHeight: 1.65, display: 'grid', gap: '0.6rem' }}>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-dark)' }}>1. المصروفات المتوقعة</strong>
                  <ul style={{ paddingRight: '1rem', margin: '0.25rem 0 0' }}>
                    <li>الإيجار بيُدفع مقدماً كل شهر.</li>
                    <li>التأمين بيُسترد بالكامل آخر العقد لو مفيش أضرار. اتأكد إنه مكتوب في العقد.</li>
                    <li>عمولة الوسيط بتُدفع مرة واحدة فقط، ومش بتتطبق لو المعلن مالك مباشر.</li>
                  </ul>
                </div>

                <div>
                  <strong style={{ display: 'block', color: 'var(--text-dark)' }}>2. عمولة الوسيط العادلة</strong>
                  <p style={{ margin: '0.25rem 0 0' }}>العمولة عادة بين 30% و100% من الإيجار الشهري، والقيمة العادلة حوالي <strong>50%</strong>. لو حد طلب أكتر من 100% اسأل عن السبب، ولو تعدت الحد بشكل واضح بلاغ عبر آلية الإبلاغ في المنصة.</p>
                </div>

                <div>
                  <strong style={{ display: 'block', color: 'var(--text-dark)' }}>3. قبل ما تحوّل أي فلوس</strong>
                  <p style={{ margin: '0.25rem 0 0' }}>متحولش أي مبلغ، ولا حتى عربون، قبل ما تعاين الوحدة بنفسك وتقابل المالك أو الوسيط وجهاً لوجه. راجع تقييمات المعلن وابحث عن علامة "موثّق من سكن".</p>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <a href="#/guide" onClick={(e) => { e.preventDefault(); navigateTo('#/guide'); }} style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    الدليل الكامل للسكن الجامعي ←
                  </a>
                </div>
              </div>
            </details>

          </div>
        </div>

      </div>

      {/* ─── Amenities Section ─── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          الخدمات والمرافق المتوفرة
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {(() => {
            const cleanAmenities = (listing.amenities || []).map(extractAmenityName).filter(Boolean);
            const hasAcRoom = listing.room_configurations?.some(c => c.has_ac);
            if (hasAcRoom && !cleanAmenities.some(a => a.includes('تكييف') || a.includes('مكيفة'))) {
              cleanAmenities.push('❄️ مكيفة');
            }
            const indoorList = cleanAmenities.filter(a => INDOOR_AMENITIES.includes(a) || a.includes('مكيفة'));
            const outdoorList = cleanAmenities.filter(a => OUTDOOR_AMENITIES.includes(a));
            const otherList = cleanAmenities.filter(a => !INDOOR_AMENITIES.includes(a) && !OUTDOOR_AMENITIES.includes(a) && !a.includes('مكيفة'));

            return (
              <>
                <div>
                  <h4 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>مرافق سكنية داخلية</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {indoorList.map((amen, i) => (
                      <span key={i} style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600 }}>
                        {amen}
                      </span>
                    ))}
                    {otherList.map((amen, i) => (
                      <span key={`oth-${i}`} style={{ background: '#f8fafc', color: '#475569', border: '1px solid var(--border)', padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600 }}>
                        {amen}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>مرافق وخدمات مجاورة</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {outdoorList.map((amen, i) => (
                      <span key={`out-${i}`} style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600 }}>
                        {amen}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ─── Ratings & Trust Section ─── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
        
        {/* Rating Summary Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem' }}>التقييمات وآراء الطلاب</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>تقييمات حقيقية من الطلاب الذين أقاموا أو تواصلوا مع المعلن.</p>
          </div>

          {isNormalUser && (
            <button 
              onClick={() => setShowRatingForm(!showRatingForm)}
              className="btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <PenTool style={{ width: 14, height: 14 }} /> أضف تقييمك
            </button>
          )}
        </div>

        {/* Inline Rating Form */}
        {showRatingForm && isNormalUser && (
          <form onSubmit={handleRatingSubmit} style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>إضافة تقييم جديد لـ {detailRatingTab === 'property' ? 'العقار السكني' : 'أمانة وتواصل المعلن'}</h4>

            <div className="form-group">
              <label>التقييم بالنجوم</label>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '1.75rem', color: '#fbbf24', cursor: 'pointer' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span key={star} onClick={() => setRatingInput({ ...ratingInput, star_count: star })}>
                    {ratingInput.star_count >= star ? '★' : '☆'}
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>التعليق المكتوب</label>
              <textarea 
                rows="3" 
                placeholder="اكتب تجربتك بالتفصيل..."
                value={ratingInput.review_text}
                onChange={(e) => setRatingInput({ ...ratingInput, review_text: e.target.value })}
                required={detailRatingTab === 'advertiser'}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowRatingForm(false)}>إلغاء</button>
              <button type="submit" className="btn-primary">نشر التقييم</button>
            </div>
          </form>
        )}

        {/* Tabs for Property vs Advertiser Ratings */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <button 
            className={`tab-btn ${detailRatingTab === 'property' ? 'active' : ''}`}
            onClick={() => setDetailRatingTab('property')}
            style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, borderBottom: detailRatingTab === 'property' ? '2px solid var(--primary)' : '2px solid transparent', color: detailRatingTab === 'property' ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            تقييمات العقار ({property_ratings.length})
          </button>
          <button 
            className={`tab-btn ${detailRatingTab === 'advertiser' ? 'active' : ''}`}
            onClick={() => setDetailRatingTab('advertiser')}
            style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, borderBottom: detailRatingTab === 'advertiser' ? '2px solid var(--primary)' : '2px solid transparent', color: detailRatingTab === 'advertiser' ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            تقييمات أمانة المعلن ({advertiser_ratings.length})
          </button>
        </div>

        {/* Ratings List */}
        <div>
          {detailRatingTab === 'property' ? (
            property_ratings.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>لا توجد تقييمات مسجلة لهذا السكن بعد.</p>
            ) : (
              property_ratings.map(r => (
                <div key={r.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{"★".repeat(r.star_count) + "☆".repeat(5 - r.star_count)}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  {r.review_text && <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0 }}>{r.review_text}</p>}
                </div>
              ))
            )
          ) : (
            advertiser_ratings.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>لا توجد تقييمات لأمانة المعلن بعد.</p>
            ) : (
              advertiser_ratings.map(r => (
                <div key={r.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{"★".repeat(r.star_count) + "☆".repeat(5 - r.star_count)}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0 }}>{r.review_text}</p>
                </div>
              ))
            )
          )}
        </div>

        {/* Complaint Banner */}
        {isNormalUser && (
          <div style={{ marginTop: '1.5rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle style={{ width: 18, height: 18, color: '#f59e0b' }} /> 
              إذا خالف المعلن أي من التفاصيل المعلنة في السعر أو العمولة، قدّم شكوى وسنحقق فوراً.
            </div>
            <button 
              onClick={() => setShowComplaintForm(!showComplaintForm)}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              تقديم شكوى
            </button>
          </div>
        )}

        {/* Inline Complaint Form */}
        {showComplaintForm && isNormalUser && (
          <form onSubmit={handleComplaintSubmit} style={{ marginTop: '1rem', background: '#fff1f2', border: '1px solid #fecdd3', padding: '1.25rem', borderRadius: '12px' }}>
            <h4 style={{ fontWeight: 700, color: '#9f1239', marginBottom: '0.75rem' }}>تقديم بلاغ شكوى رسمي لمشرفي المنصة</h4>

            <div className="form-group">
              <label>نوع المخالفة المرتكبة</label>
              <select value={complaintInput.violation_type} onChange={(e) => setComplaintInput({ ...complaintInput, violation_type: e.target.value })}>
                <option value="السعر المطلوب أعلى من المعلن">السعر المطلوب أعلى من المعلن</option>
                <option value="العمولة أعلى من المعلن">العمولة أعلى من المعلن</option>
                <option value="تفاصيل السكن لا تطابق الواقع">تفاصيل السكن لا تطابق الواقع</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div className="form-group">
              <label>تفاصيل الشكوى والواقعة (٢٠ حرف كحد أدنى)</label>
              <textarea 
                rows="3" 
                placeholder="اشرح الواقعة بالتفصيل..."
                value={complaintInput.description}
                onChange={(e) => setComplaintInput({ ...complaintInput, description: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowComplaintForm(false)}>إلغاء</button>
              <button type="submit" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                إرسال البلاغ للتحقيق
              </button>
            </div>
          </form>
        )}

      </div>

    </div>
  );
}
