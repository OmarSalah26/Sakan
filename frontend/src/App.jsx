import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from './router/Router';
import { useApp } from './context/AppContext';
import { formatShareText } from './pages/ListingDetailPage';

import { 
  Bell, BookOpen, Plus, Search, MapPin, CheckCircle, CheckCircle2, ShieldCheck, 
  AlertTriangle, Ban, Trash2, StopCircle, Star, Info, Megaphone, 
  User, Home, Briefcase, MessageSquare, Phone, Camera, Send, 
  Save, Share2, FileText, PenTool, Calendar, Shield, Zap, Plug,
  Bed, Check, Clock, Award, Sparkles, Upload, Menu, X, Smartphone,
  Navigation, Wind, Video, ArrowDown, Compass, Building2, Mail, LogOut
} from 'lucide-react';


// Fix Leaflet's default marker icon paths broken by Vite's asset pipeline
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// ---------------------------------------------------------------------------
// formatAddress - builds a display string from structured address fields
// Falls back to raw address string for old listings
// ---------------------------------------------------------------------------
function formatAddress(listing) {
  return listing.full_address || listing.address || '';
}

// ---------------------------------------------------------------------------
// MapPickerModal - full-screen modal with Leaflet, draggable marker.
// ---------------------------------------------------------------------------
function MapPickerModal({ city, cityFallback, governorate, initialLat, initialLng, onConfirm, onClose }) {
  const currentCity = city || cityFallback || governorate || '';
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [pending, setPending] = useState({ lat: initialLat, lng: initialLng });
  const [mapType, setMapType] = useState('hybrid'); // default to Hybrid Satellite with Labels

  const MAP_PROVIDERS = {
    hybrid: {
      name: '🛰️ أقمار صناعية مع الأسماء والشوارع (Bing / Hybrid)',
      urls: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png'
      ],
      attribution: '&copy; Esri / Bing Satellite &copy; OpenStreetMap'
    },
    osm: {
      name: '🗺️ خريطة قياسية (OpenStreetMap)',
      urls: [
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      attribution: '&copy; OpenStreetMap'
    }
  };

  const applyMapLayers = (type, mapInstance) => {
    const targetMap = mapInstance || mapRef.current;
    if (!targetMap) return;
    if (tileLayerRef.current) {
      targetMap.removeLayer(tileLayerRef.current);
    }
    const provider = MAP_PROVIDERS[type] || MAP_PROVIDERS.hybrid;
    const layers = provider.urls.map((u, i) => L.tileLayer(u, {
      attribution: provider.attribution,
      maxZoom: 19,
      zIndex: i + 1
    }));
    tileLayerRef.current = L.layerGroup(layers).addTo(targetMap);
  };

  const handleMapTypeChange = (newType) => {
    setMapType(newType);
    applyMapLayers(newType);
  };

  useEffect(() => {
    const init = () => {
      if (!containerRef.current) return;

      const govKey = Object.keys(GOVERNORATE_COORDS).find(g => (governorate || cityFallback)?.includes(g)) || "القاهرة";
      const defaultCenter = GOVERNORATE_COORDS[govKey] || [30.0444, 31.2357];

      const map = L.map(containerRef.current).setView(defaultCenter, 13);
      mapRef.current = map;
      applyMapLayers(mapType, map);

      const placeMarker = (lat, lng, zoomLevel = 15) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.bindTooltip('مدخل العقار (اسحب الدبوس لضبط المكان)', {
            permanent: true,
            direction: 'top',
            offset: [0, -32],
            className: 'custom-map-tooltip'
          });
          markerRef.current.on('dragend', (e) => {
            const { lat: la, lng: ln } = e.target.getLatLng();
            setPending({ lat: la, lng: ln });
          });
        }
        map.setView([lat, lng], zoomLevel);
        setPending({ lat, lng });
      };

      if (initialLat && initialLng) {
        placeMarker(initialLat, initialLng, 16);
      } else {
        placeMarker(defaultCenter[0], defaultCenter[1], 13);
      }

      map.on('click', (e) => placeMarker(e.latlng.lat, e.latlng.lng, map.getZoom()));
    };

    init();
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; tileLayerRef.current = null; } };
  }, []);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (mapRef.current) {
            if (markerRef.current) {
              markerRef.current.setLatLng([latitude, longitude]);
            } else {
              markerRef.current = L.marker([latitude, longitude], { draggable: true }).addTo(mapRef.current);
            }
            mapRef.current.setView([latitude, longitude], 16);
            setPending({ lat: latitude, lng: longitude });
          }
        },
        () => {
          alert("تعذر الوصول للموقع الحالي. يرجى التأكد من سماح المتصفح بمشاركة الموقع.");
        }
      );
    } else {
      alert("خاصية تحديد الموقع غير مدعومة في متصفحك.");
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: '#ffffff',
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh'
    }}>
      {/* Header */}
      <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', zIndex: 10, flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>
            <MapPin style={{ width: 18, height: 18, display: 'inline', verticalAlign: 'middle', color: 'var(--primary)', marginLeft: '0.25rem' }} /> 
            تحديد موقع العقار على الخريطة {currentCity ? `(${currentCity})` : ''}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            اسحب الدبوس الأحمر أو اضغط على الخريطة لضبط الموقع بدقة.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={handleGetCurrentLocation}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--r-md)', border: '1px solid var(--primary)', background: '#eff6ff', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Navigation style={{ width: 15, height: 15 }} /> موقعي الحالي
          </button>
          <select 
            value={mapType}
            onChange={(e) => handleMapTypeChange(e.target.value)}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--primary-light)', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}
          >
            {Object.entries(MAP_PROVIDERS).map(([key, provider]) => (
              <option key={key} value={key}>{provider.name}</option>
            ))}
          </select>
          <button className="modal-close" style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem' }} onClick={onClose}>×</button>
        </div>
      </div>

      {/* Map (Full Height) */}
      <div ref={containerRef} style={{ width: '100%', flex: 1, minHeight: 0 }} />

      {/* Footer */}
      <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', zIndex: 10 }}>
        <span style={{ fontSize: '0.85rem', color: pending.lat ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
          {pending.lat
            ? `إحداثيات الموقع المحدد: (${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)})`
            : 'اضغط في أي مكان على الخريطة لوضع الدبوس'}
        </span>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ padding: '0.5rem 1.25rem' }} onClick={onClose}>إلغاء</button>
          <button
            className="btn-primary"
            style={{ padding: '0.5rem 1.5rem' }}
            disabled={!pending.lat}
            onClick={() => onConfirm(pending.lat, pending.lng)}
          >
            تأكيد الموقع والعودة للإعلان <Check style={{ width: 16, height: 16, display: 'inline', marginRight: '0.25rem' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

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

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "البحر الأحمر", "المنوفية", 
  "الفيوم", "قنا", "الأقصر", "أسوان", "أسيوط", "المنيا", "بني سويف", 
  "الشرقية", "القليوبية", "الغربية", "البحيرة", "دمياط", "كفر الشيخ", 
  "بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء", "جنوب سيناء", 
  "الوادي الجديد", "مطروح"
];

const GOVERNORATE_COORDS = {
  "القاهرة": [30.0444, 31.2357],
  "الجيزة": [30.0131, 31.2089],
  "الإسكندرية": [31.2001, 29.9187],
  "الدقهلية": [31.0409, 31.3785],
  "البحر الأحمر": [27.2579, 33.8116],
  "المنوفية": [30.5972, 30.9876],
  "الفيوم": [29.3084, 30.8428],
  "قنا": [26.1551, 32.7160],
  "الأقصر": [25.6872, 32.6396],
  "أسوان": [24.0889, 32.8998],
  "أسيوط": [27.1783, 31.1859],
  "المنيا": [28.0871, 30.7618],
  "بني سويف": [29.0661, 31.0994],
  "الشرقية": [30.5877, 31.5020],
  "القليوبية": [30.4660, 31.1850],
  "الغربية": [30.7865, 31.0004],
  "البحيرة": [31.0404, 30.4700],
  "دمياط": [31.4175, 31.8144],
  "كفر الشيخ": [31.1107, 30.9388],
  "بورسعيد": [31.2653, 32.3019],
  "الإسماعيلية": [30.5965, 32.2715],
  "السويس": [29.9668, 32.5498],
  "شمال سيناء": [31.1316, 33.7984],
  "جنوب سيناء": [27.9158, 34.3299],
  "الوادي الجديد": [25.4514, 30.5463],
  "مطروح": [31.3543, 27.2373]
};

const DEFAULT_GOVERNORATES_LIST = GOVERNORATES.map((gname, idx) => ({
  id: idx + 1,
  name: gname,
  status: (gname === 'أسيوط' || gname === 'دمياط') ? 'live' : 'waitlist_open',
  waitlist_count: 0
}));

const PRESETS_PROPERTY_IMAGES = [
  "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=600&q=80"
];

const PRESETS_PROPERTY_VIDEOS = [
  "https://www.w3schools.com/html/mov_bbb.mp4"
];

const INDOOR_AMENITIES = [
  { name: "واي فاي", category: "الإنترنت والمرافق", prechecked: false },
  { name: "تكييف", category: "الإنترنت والمرافق", prechecked: false },
  { name: "مراوح", category: "الإنترنت والمرافق", prechecked: true },
  { name: "مياه ساخنة", category: "الإنترنت والمرافق", prechecked: true },
  { name: "مولد كهرباء / كهرباء احتياطية", category: "الإنترنت والمرافق", prechecked: false },
  { name: "ثلاجة", category: "المطبخ", prechecked: true },
  { name: "بوتاجاز", category: "المطبخ", prechecked: true },
  { name: "ميكروويف", category: "المطبخ", prechecked: false },
  { name: "فلتر مياه", category: "المطبخ", prechecked: true },
  { name: "أدوات مطبخ", category: "المطبخ", prechecked: false },
  { name: "مكتب للمذاكرة", category: "الغرفة", prechecked: true },
  { name: "كرسي مكتب", category: "الغرفة", prechecked: false },
  { name: "دولاب ملابس", category: "الغرفة", prechecked: false },
  { name: "غسالة", category: "الغرفة", prechecked: true },
  { name: "منشر", category: "الغرفة", prechecked: false },
  { name: "مكواة", category: "الغرفة", prechecked: false },
  { name: "كاميرات مراقبة", category: "الأمن والخدمات", prechecked: false },
  { name: "أمن 24 ساعة", category: "الأمن والخدمات", prechecked: false },
  { name: "تنظيف دوري", category: "الأمن والخدمات", prechecked: false },
  { name: "صيانة", category: "الأمن والخدمات", prechecked: false },
  { name: "مصعد", category: "المبنى", prechecked: false },
  { name: "غرفة مذاكرة", category: "مساحات مشتركة", prechecked: false },
  { name: "صالة جلوس مشتركة", category: "مساحات مشتركة", prechecked: false },
  { name: "بلكونة", category: "مساحات مشتركة", prechecked: false }
];

const OUTDOOR_AMENITIES = [
  { name: "قريب من الجامعة", category: "التعليم", prechecked: false },
  { name: "قريب من المواصلات العامة", category: "المواصلات", prechecked: false },
  { name: "سوبر ماركت", category: "التسوق", prechecked: false },
  { name: "مخبز", category: "التسوق", prechecked: false },
  { name: "مطاعم", category: "الطعام", prechecked: false },
  { name: "كافيهات", category: "الطعام", prechecked: false },
  { name: "صيدلية", category: "الصحة", prechecked: false },
  { name: "مستشفى", category: "الصحة", prechecked: false },
  { name: "عيادة طبية", category: "الصحة", prechecked: false },
  { name: "جيم", category: "الرياضة", prechecked: false },
  { name: "مسجد", category: "خدمات عامة", prechecked: false },
  { name: "كنيسة", category: "خدمات عامة", prechecked: false },
  { name: "ماكينة صراف آلي (ATM)", category: "خدمات عامة", prechecked: false },
  { name: "بنك", category: "خدمات عامة", prechecked: false },
  { name: "محل طباعة وتصوير", category: "الخدمات اليومية", prechecked: false },
  { name: "مكتبة", category: "الخدمات اليومية", prechecked: false }
];

export function formatUnifiedShareText(listing) {
  if (!listing) return '';
  const genderStr = listing.gender === 'male' ? 'سكن طلاب (شباب)' : 'سكن طالبات (بنات)';
  
  const configs = Array.isArray(listing.room_configurations) 
    ? listing.room_configurations 
    : typeof listing.room_configurations === 'string'
      ? JSON.parse(listing.room_configurations || '[]')
      : [];

  let totalBeds = 0;
  let servicesInclusive = false;
  let hasInsurance = false;
  let insuranceAmount = null;
  let unitTotalPrice = 0;
  const roomTypesList = [];

  if (Array.isArray(configs) && configs.length > 0) {
    configs.forEach(c => {
      const roomType = c.room_type || 'single';
      const label = roomType === 'single' ? 'فردية' : roomType === 'double' ? 'ثنائية' : roomType === 'triple' ? 'ثلاثية' : 'رباعية';
      const multiplier = roomType === 'double' ? 2 : roomType === 'triple' ? 3 : roomType === 'quadruple' ? 4 : 1;
      const count = c.count || 1;
      const price = c.price_per_person || 0;
      
      totalBeds += multiplier * count;
      unitTotalPrice += (price * count * multiplier);
      roomTypesList.push(`${count} غرفة ${label}`);

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
  if (!unitTotalPrice && listing.price_per_person) {
    unitTotalPrice = listing.price_per_person;
  }

  const locationParts = [listing.governorate, listing.city, listing.neighborhood].filter(Boolean);
  const locationStr = locationParts.join('، ');

  const availStr = `${listing.available_beds || 1} سرير متاح من أصل ${totalBeds}`;
  let depositStr = 'بدون تأمين';
  if (hasInsurance && insuranceAmount) {
    depositStr = `تأمين: ${insuranceAmount} ج.م`;
  } else if (hasInsurance) {
    depositStr = 'يتطلب دفع تأمين';
  }

  const servicesStr = servicesInclusive ? 'الخدمات مشمولة' : 'الخدمات غير مشمولة';

  const lines = [
    genderStr,
    locationStr,
    roomTypesList.length > 0 ? `تكوين الغرف: ${roomTypesList.join('، ')}` : null,
    availStr,
    depositStr,
    servicesStr,
    unitTotalPrice ? `السعر الكلي: ${unitTotalPrice.toLocaleString()} ج.م/شهرياً` : null,
    'التفاصيل والصور على سكن:',
    `https://sakan-egy.com/listings/${listing.id}`
  ].filter(Boolean);

  return lines.join('\n');
}

export default function App() {
  const { user, setUser, showToast } = useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState('browse'); // 'browse' | 'dashboard' | 'admin' | 'saved' | 'guide' | 'about' | 'terms' | 'profile'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [listings, setListings] = useState([]);

  const handleCardClick = (listingId) => {
    try {
      sessionStorage.setItem('last_opened_listing_id', String(listingId));
      sessionStorage.setItem('last_feed_scroll_y', String(window.scrollY));
    } catch {}
    navigate(`/listings/${listingId}`);
  };

  const openListingDetail = (listingId) => {
    navigate(`/listings/${listingId}`);
  };

  // Restore scroll position to the exact opened listing card after listings load
  useEffect(() => {
    if (listings.length > 0) {
      const lastId = sessionStorage.getItem('last_opened_listing_id');
      const lastScrollY = sessionStorage.getItem('last_feed_scroll_y');
      
      if (lastId || lastScrollY) {
        const timer = setTimeout(() => {
          if (lastId) {
            const cardEl = document.getElementById(`listing-card-${lastId}`);
            if (cardEl) {
              cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              sessionStorage.removeItem('last_opened_listing_id');
              sessionStorage.removeItem('last_feed_scroll_y');
              return;
            }
          }
          if (lastScrollY) {
            window.scrollTo({ top: parseInt(lastScrollY, 10), behavior: 'smooth' });
            sessionStorage.removeItem('last_opened_listing_id');
            sessionStorage.removeItem('last_feed_scroll_y');
          }
        }, 120);
        return () => clearTimeout(timer);
      }
    }
  }, [listings]);
  
  // Bulk Add state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkJsonText, setBulkJsonText] = useState('');
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState(null);

  const handleBulkSubmit = async () => {
    if (!bulkJsonText.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(bulkJsonText);
    } catch (e) {
      showToast('تنسيق JSON غير صالح، يرجى مراجعة القواعد والفاصلات');
      return;
    }

    if (!Array.isArray(parsed)) {
      showToast('البيانات يجب أن تكون مصفوفة JSON Array [ ... ]');
      return;
    }

    try {
      setIsBulkLoading(true);
      setBulkImportResult(null);

      const res = await fetch(`${API_BASE}/listings/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user ? { 'x-user-id': String(user.id) } : {})
        },
        body: JSON.stringify(parsed)
      });

      if (res.ok) {
        const data = await res.json();
        setBulkImportResult(data);
        showToast(`تم استيراد ${data.created_count} إعلان بنجاح!`);
        loadListings();
        if (user && user.account_type === 'admin') loadAdminData();
      } else {
        const err = await res.json();
        showToast(err.detail || 'خطأ أثناء تنفيذ الاستيراد');
      }
    } catch (e) {
      showToast('خطأ في الاتصال بالخادم أثناء تنفيذ الاستيراد');
    } finally {
      setIsBulkLoading(false);
    }
  };
  
  // Auth state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'register' | 'login'
  const [authLoginMethod, setAuthLoginMethod] = useState('password'); // 'password' | 'otp'
  const [authStep, setAuthStep] = useState('phone'); // 'phone' | 'otp' | 'details' | 'change_password'
  const [authForm, setAuthForm] = useState({
    phone: '',
    otp: '',
    name: '',
    account_type: 'student', // 'student' | 'broker' | 'admin'
    governorates: [],
    profile_photo_url: '',
    password: '',
    new_password: '',
    confirm_password: ''
  });
  const [mustChangeUser, setMustChangeUser] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // callback after auth success
  
  // Filters state
  const [filters, setFilters] = useState({
    governorate: '',
    city: '',
    neighborhood: '',
    gender: '',
    min_price: '',
    max_price: '',
    room_types: [],
    amenities: [],
    advertiser_type: '',
    max_commission: '',
    services_inclusive: false,
    has_insurance: false,
    min_total_beds: '',
    max_total_beds: ''
  });

  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'price_asc' | 'price_desc'
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Create listing wizard state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [termsChecked, setTermsChecked] = useState(false);
  const [customAmenity, setCustomAmenity] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    governorate: '',
    city: '',
    neighborhood: '',
    full_address: '',
    address: '',
    floor: '',
    maps_link: '',
    latitude: null,
    longitude: null,
    gender: 'female',
    available_beds: 1,
    room_configurations: [{ room_type: 'single', price_per_person: 1000, commission: 500, count: 1, insurance_price: '', services_inclusive: false }],
    amenities: INDOOR_AMENITIES.filter(a => a.prechecked).map(a => a.name).concat(OUTDOOR_AMENITIES.filter(a => a.prechecked).map(a => a.name)),
    photo_urls: [...PRESETS_PROPERTY_IMAGES],
    video_urls: [...PRESETS_PROPERTY_VIDEOS],
    description: '',
    tier: 'regular',
    min_lease_months: null
  });

  // Post-Publish Share Modal state
  const [postPublishListing, setPostPublishListing] = useState(null);
  const [isPostPublishModalOpen, setIsPostPublishModalOpen] = useState(false);

  // Listing Detail Modal state
  const [selectedListingDetail, setSelectedListingDetail] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [detailRatingTab, setDetailRatingTab] = useState('property'); // 'property' | 'advertiser'
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);

  // Rating forms state
  const [ratingInput, setRatingInput] = useState({
    star_count: 5,
    review_text: '',
    photo_urls: []
  });

  // Complaint form state
  const [complaintInput, setComplaintInput] = useState({
    violation_type: 'السعر المطلوب أعلى من المعلن',
    description: '',
    evidence_urls: []
  });

  // Admin moderation lists
  const [adminComplaints, setAdminComplaints] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminListings, setAdminListings] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [adminTab, setAdminTab] = useState('complaints'); // 'complaints' | 'users' | 'listings' | 'ratings' | 'leaderboard' | 'governorates'
  const [adminSearch, setAdminSearch] = useState('');
  const [adminRatings, setAdminRatings] = useState([]);

  // Geo-scaling Waitlist State
  const [dbGovernorates, setDbGovernorates] = useState(DEFAULT_GOVERNORATES_LIST);
  const [isAreaGateOpen, setIsAreaGateOpen] = useState(false);
  const [areaGateForm, setAreaGateForm] = useState({ governorate_id: DEFAULT_GOVERNORATES_LIST[0].id });
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [waitlistStep, setWaitlistStep] = useState('form'); // 'form' | 'otp' | 'success'
  const [waitlistForm, setWaitlistForm] = useState({
    governorate_id: null,
    governorate_name: '',
    city: '',
    name: '',
    phone: '',
    work_volume_range: '1-4',
    verified_channel: 'whatsapp',
    otp: ''
  });
  const [waitlistResult, setWaitlistResult] = useState(null);
  const [adminGovernorates, setAdminGovernorates] = useState([]);
  const [adminWaitlistEntries, setAdminWaitlistEntries] = useState([]);
  const [adminWaitlistFilterGov, setAdminWaitlistFilterGov] = useState('');
  const [outreachSummaryModal, setOutreachSummaryModal] = useState(null);
  const [outreachModalData, setOutreachModalData] = useState(null);
  const [editingListing, setEditingListing] = useState(null);

  const handleGenerateEditLink = async (listingId) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/admin/listings/${listingId}/generate-edit-link?x_user_id=${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(user.id),
          'x_user_id': String(user.id)
        }
      });
      if (res.ok) {
        const data = await res.json();
        setOutreachModalData(data);

        // 1. Auto-copy outreach message to clipboard
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(data.whatsapp_message);
          }
        } catch {}

        // 2. Format phone number and open WhatsApp directly with pre-filled message
        let phone = (data.contact_phone || '').replace(/\D/g, '');
        if (phone.startsWith('01') && phone.length === 11) {
          phone = '2' + phone;
        }

        const waUrl = phone 
          ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(data.whatsapp_message)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(data.whatsapp_message)}`;

        window.open(waUrl, '_blank');
        showToast('تم نسخ نص الرسالة وفتح الواتساب مباشرة!');
      } else {
        const err = await res.json();
        showToast(err.detail || 'فشل توليد رابط التعديل');
      }
    } catch {
      showToast('خطأ في الاتصال بالخادم');
    }
  };

  const handleOpenEditFlow = (item) => {
    setEditingListing(item);
    const parseArr = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v.trim().startsWith('[')) {
        try { return JSON.parse(v); } catch {}
      }
      return [];
    };

    const roomConfigs = parseArr(item.room_configurations);
    const amenitiesList = parseArr(item.amenities);
    const photoUrlsList = parseArr(item.photo_urls);
    const videoUrlsList = parseArr(item.video_urls);

    setCreateForm({
      title: item.title || '',
      governorate: item.governorate || '',
      city: item.city || '',
      neighborhood: item.neighborhood || '',
      full_address: item.address || '',
      address: item.address || '',
      floor: item.floor || '',
      maps_link: item.maps_link || '',
      latitude: item.latitude || null,
      longitude: item.longitude || null,
      gender: item.gender || 'female',
      available_beds: item.available_beds || 1,
      room_configurations: roomConfigs.length > 0 ? roomConfigs : [{ room_type: 'single', price_per_person: 1000, commission: 500, count: 1, insurance_price: '', services_inclusive: false }],
      amenities: amenitiesList,
      photo_urls: photoUrlsList,
      video_urls: videoUrlsList,
      description: item.description || '',
      tier: item.tier || 'regular',
      min_lease_months: item.min_lease_months || null,
      source: item.source || 'normal',
      full_edit_available: item.full_edit_available || false,
      location_precise: item.location_precise || false
    });
    setShowMapPicker(false);
    setIsCreateOpen(true);
    setCreateStep(1);
    setTermsChecked(true);
  };

  // Load bookmarked listing IDs
  const loadBookmarks = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/bookmarks/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setBookmarkedIds(data.listing_ids || []);
      }
    } catch {}
  };

  const toggleBookmark = async (listingId, e) => {
    if (e) { e.stopPropagation(); }
    if (!user) {
      showToast('سجل دخولك أولاً لحفظ الإعلانات');
      return;
    }
    const isBookmarked = bookmarkedIds.includes(listingId);
    try {
      if (isBookmarked) {
        await fetch(`${API_BASE}/bookmarks/${user.id}/${listingId}`, { method: 'DELETE' });
        setBookmarkedIds(prev => prev.filter(id => id !== listingId));
        showToast('تم إزالة الإعلان من المحفوظات');
      } else {
        await fetch(`${API_BASE}/bookmarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, listing_id: listingId })
        });
        setBookmarkedIds(prev => [...prev, listingId]);
        showToast('تم حفظ الإعلان');
      }
    } catch {
      showToast('خطأ في حفظ الإعلان');
    }
  };

  // Fetch listings helper
  const loadListings = async () => {
    try {
      const q = new URLSearchParams();
      if (filters.governorate) q.append('governorate', filters.governorate);
      if (filters.city) q.append('city', filters.city);
      if (filters.neighborhood) q.append('neighborhood', filters.neighborhood);
      if (filters.gender) q.append('gender', filters.gender);
      if (filters.min_price) q.append('min_price', filters.min_price);
      if (filters.max_price) q.append('max_price', filters.max_price);
      if (filters.room_types.length) q.append('room_types', filters.room_types.join(','));
      if (filters.amenities.length) q.append('amenities', filters.amenities.join(','));
      if (filters.advertiser_type) q.append('advertiser_type', filters.advertiser_type);
      if (filters.max_commission) q.append('max_commission', filters.max_commission);
      if (filters.services_inclusive) q.append('services_inclusive', 'true');
      if (filters.has_insurance) q.append('has_insurance', 'true');
      if (filters.min_total_beds) q.append('min_total_beds', filters.min_total_beds);
      if (filters.max_total_beds) q.append('max_total_beds', filters.max_total_beds);

      const res = await fetch(`${API_BASE}/listings?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sortedListings = [...listings].sort((a, b) => {
    if (sortBy === 'newest') return (b.id || 0) - (a.id || 0);
    if (sortBy === 'oldest') return (a.id || 0) - (b.id || 0);
    if (sortBy === 'price_asc') return (a.price_per_person || 0) - (b.price_per_person || 0);
    if (sortBy === 'price_desc') return (b.price_per_person || 0) - (a.price_per_person || 0);
    return 0;
  });

  useEffect(() => {
    loadListings();
    loadGovernorates();
  }, [filters]);

  useEffect(() => {
    if (user) {
      loadBookmarks();
      if (user.account_type === 'admin') {
        loadAdminData();
      }
    } else {
      setBookmarkedIds([]);
    }
  }, [user]);

  useEffect(() => {
    if (tab === 'admin' && user && user.account_type === 'admin') {
      loadAdminData();
    }
  }, [tab, user]);

  // Query Parameter Handler (Auth & Edit)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    if (authParam === 'login' || authParam === 'register') {
      handleStartAuth(authParam);
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
    const editId = params.get('edit');
    if (editId) {
      fetch(`${API_BASE}/listings/${editId}`)
        .then(r => r.json())
        .then(data => {
          const item = data.listing || data;
          if (item && item.id) {
            handleOpenEditFlow(item);
          }
        })
        .catch(() => {});
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, []);

  // Hash Routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('edit=')) {
        const match = hash.match(/edit=(\d+)/);
        if (match && match[1]) {
          const editId = match[1];
          fetch(`${API_BASE}/listings/${editId}`)
            .then(r => r.json())
            .then(data => {
              const item = data.listing || data;
              if (item && item.id) {
                handleOpenEditFlow(item);
              }
            })
            .catch(() => {});
        }
      } else if (hash.startsWith('#/profile/')) {
        const uid = hash.replace('#/profile/', '');
        setProfileUserId(uid);
        setTab('profile');
      } else {
        navigateTo(hash || '#/browse');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (tab === 'profile' && profileUserId) {
      fetch(`${API_BASE}/users/${profileUserId}/profile`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setProfileData(data); })
        .catch(() => {});
    }
  }, [tab, profileUserId]);

  const navigateTo = (newHash) => {
    const raw = newHash.replace('#/', '').replace('#', '');
    const targetTab = raw || 'browse';
    setTab(targetTab);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  };



  // Role verification tags
  const isBroker = user && (user.account_type === 'broker' || user.account_type === 'owner');
  const isAdmin = user && user.account_type === 'admin';
  const isNormalUser = user && (user.account_type === 'student' || user.account_type === 'normal_user');

  // Bulletproof tab resolution to prevent blank pages
  const isDashboardTabValid = tab === 'dashboard' && (isBroker || isAdmin);
  const isAdminTabValid = tab === 'admin' && isAdmin;
  const isSavedTabValid = tab === 'saved' && user;
  const isOtherTab = ['guide', 'about', 'terms', 'profile'].includes(tab);
  const isBrowseTab = tab === 'browse' || (!isDashboardTabValid && !isAdminTabValid && !isSavedTabValid && !isOtherTab);

  const pendingActionRef = useRef(null); // persistent callback after auth success

  // Check if active user must change password
  useEffect(() => {
    if (user && user.must_change_password) {
      setMustChangeUser(user);
      setAuthStep('change_password');
      setIsAuthOpen(true);
    }
  }, [user]);

  // --- Auth logic ---
  const handleStartAuth = (mode, overrideType = null, callback = null, initialPhone = '') => {
    setAuthMode(mode);
    setAuthLoginMethod('password');
    const defaultGovs = (createForm.governorate && GOVERNORATES.includes(createForm.governorate)) 
      ? [createForm.governorate] 
      : [];
    setAuthForm({
      phone: initialPhone || '',
      otp: '',
      name: '',
      account_type: overrideType || 'broker',
      governorates: defaultGovs,
      profile_photo_url: '',
      password: '',
      new_password: '',
      confirm_password: ''
    });
    setAuthStep('phone');
    pendingActionRef.current = callback;
    setIsAuthOpen(true);
  };

  const handlePasswordLoginSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = (authForm.phone || '').trim();
    const cleanPwd = (authForm.password || '').trim();
    if (cleanPhone.length < 8) {
      showToast("يرجى إدخال رقم هاتف صحيح لا يقل عن 8 أرقام");
      return;
    }
    if (!cleanPwd) {
      showToast("يرجى إدخال كلمة المرور");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/login-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password: cleanPwd })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.must_change_password) {
          setMustChangeUser(data);
          setAuthStep('change_password');
          showToast("مرحباً بك! يرجى تعيين كلمة مرور جديدة لحسابك لمتابعة استخدام المنصة");
        } else {
          setUser(data);
          setIsAuthOpen(false);
          showToast(`تم تسجيل الدخول بنجاح! مرحباً بك، ${data.name || ''}`);
          if (pendingActionRef.current) {
            const cb = pendingActionRef.current;
            pendingActionRef.current = null;
            cb(data);
          }
        }
      } else {
        showToast(data.detail || "خطأ أثناء تسجيل الدخول بكلمة المرور");
      }
    } catch (err) {
      showToast("فشل الاتصال بالخادم");
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    const targetUserId = mustChangeUser ? mustChangeUser.id : (user ? user.id : null);
    if (!targetUserId) {
      showToast("خطأ في تحديد الحساب المراد تغيير كلمة مروره");
      return;
    }
    const newPwd = (authForm.new_password || '').trim();
    const confirmPwd = (authForm.confirm_password || '').trim();

    if (newPwd.length < 6) {
      showToast("كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف");
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetUserId, new_password: newPwd })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setMustChangeUser(null);
        setIsAuthOpen(false);
        showToast("تم تعيين كلمة المرور الجديدة بنجاح!");
        if (pendingActionRef.current) {
          const cb = pendingActionRef.current;
          pendingActionRef.current = null;
          cb(data);
        }
      } else {
        showToast(data.detail || "فشل حفظ كلمة المرور الجديدة");
      }
    } catch (err) {
      showToast("فشل الاتصال بالخادم");
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = (authForm.phone || '').trim();
    if (cleanPhone.length < 8) {
      showToast("يرجى إدخال رقم هاتف صحيح لا يقل عن 8 أرقام");
      return;
    }
    try {
      const endpoint = authMode === 'register' ? 'register' : 'login-otp';
      const validAccountType = ['student', 'owner', 'broker', 'admin'].includes(authForm.account_type) ? authForm.account_type : 'student';
      const payload = authMode === 'register' ? {
        phone: cleanPhone,
        name: (authForm.name || '').trim() || "مستخدم جديد",
        account_type: validAccountType,
        governorates: Array.isArray(authForm.governorates) ? authForm.governorates : [],
        profile_photo_url: authForm.profile_photo_url || null
      } : {
        phone: cleanPhone
      };

      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setAuthForm(prev => ({ ...prev, otp: data.otp_code }));
        setAuthStep('otp');
        showToast(`تم إرسال كود التحقق (كود تجريبي: ${data.otp_code})`);
      } else {
        showToast(data.detail || "خطأ أثناء إرسال الطلب");
      }
    } catch (err) {
      showToast("عذراً، فشل الاتصال بالخادم");
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    const cleanPhone = (authForm.phone || '').trim();
    const cleanOtp = (authForm.otp || '').trim();
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          otp_code: cleanOtp
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Upload avatar if user selected a file during registration
        let finalUser = { ...data };
        if (authForm._avatarFile && data.id) {
          try {
            const fd = new FormData();
            fd.append('file', authForm._avatarFile);
            const uploadRes = await fetch(`${API_BASE}/upload/avatar?user_id=${data.id}`, { method: 'POST', body: fd });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              finalUser.profile_photo_url = `${API_BASE}${uploadData.url}`;
            }
          } catch {}
        }
        if (authMode === 'register' && data.account_type !== 'student' && (!data.name || data.name === "مستخدم جديد")) {
          setUser(finalUser);
          setAuthStep('details');
        } else {
          setUser(finalUser);
          setIsAuthOpen(false);
          showToast(`تم تسجيل الدخول بنجاح! مرحباً بك، ${data.name || ''}`);
          if (pendingActionRef.current) {
            const cb = pendingActionRef.current;
            pendingActionRef.current = null;
            cb(finalUser);
          } else {
            if (data.account_type === 'broker' || data.account_type === 'owner') {
              navigateTo('#/dashboard');
            } else if (data.account_type === 'admin') {
              navigateTo('#/admin');
            } else {
              navigateTo('#/browse');
            }
          }
        }
      } else {
        showToast(data.detail || "كود التحقق غير صحيح");
      }
    } catch (err) {
      showToast("فشل التحقق من الكود");
    }
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          name: authForm.name,
          account_type: user.account_type || 'broker',
          governorates: authForm.governorates,
          profile_photo_url: authForm.profile_photo_url
        })
      });
      const data = await res.json();
      if (res.ok) {
        const updatedUser = {
          ...user,
          name: authForm.name,
          account_type: user?.account_type || 'broker',
          governorates: authForm.governorates,
          profile_photo_url: authForm.profile_photo_url
        };
        setUser(updatedUser);
        setIsAuthOpen(false);
        showToast(`تم اكتمال إعداد حسابك بنجاح!`);
        if (pendingActionRef.current) {
          const cb = pendingActionRef.current;
          pendingActionRef.current = null;
          cb(updatedUser);
        } else {
          if (updatedUser.account_type === 'broker' || updatedUser.account_type === 'owner') {
            navigateTo('#/dashboard');
          } else if (updatedUser.account_type === 'admin') {
            navigateTo('#/admin');
          } else {
            navigateTo('#/browse');
          }
        }
      }
    } catch (err) {
      showToast("حدث خطأ أثناء حفظ البيانات");
    }
  };



  // --- Create Listing wizard flow ---
  const handleOpenCreateFlow = () => {
    if (user && user.governorates && user.governorates.length > 0) {
      const liveGov = dbGovernorates.find(g => user.governorates.includes(g.name) && g.status === 'live');
      if (liveGov) {
        setCreateForm(prev => ({
          ...prev,
          title: '',
          governorate: liveGov.name,
          city: '',
          neighborhood: '',
          full_address: '',
          address: '',
          floor: '',
          maps_link: '',
          latitude: null,
          longitude: null,
          gender: 'female',
          available_beds: 1,
          room_configurations: [{ room_type: 'single', price_per_person: 1000, commission: 500, count: 1, insurance_price: '', services_inclusive: false }],
          amenities: INDOOR_AMENITIES.filter(a => a.prechecked).map(a => a.name).concat(OUTDOOR_AMENITIES.filter(a => a.prechecked).map(a => a.name)),
          photo_urls: [...PRESETS_PROPERTY_IMAGES],
          video_urls: [...PRESETS_PROPERTY_VIDEOS],
          description: '',
          tier: 'regular',
          min_lease_months: null
        }));
        setShowMapPicker(false);
        setIsCreateOpen(true);
        setCreateStep(1);
        setTermsChecked(false);
        return;
      }
    }
    setIsAreaGateOpen(true);
    setAreaGateForm({ governorate_id: dbGovernorates[0]?.id || 1 });
  };

  const handleStep2Next = () => {
    setCreateStep(3);
  };

  const handleCreateSubmit = async () => {
    let activeUser = user;
    if (!activeUser) {
      try {
        const saved = localStorage.getItem('sakan_user');
        if (saved) activeUser = JSON.parse(saved);
      } catch {}
    }

    const isEditing = Boolean(editingListing && editingListing.id);
    if (isEditing) {
      const targetPhone = editingListing.contact_phone || editingListing.whatsapp_phone || '';
      const isOwnerOrAdmin = activeUser && (activeUser.id === editingListing.advertiser_id || activeUser.account_type === 'admin');

      if (!activeUser || activeUser.must_change_password || !isOwnerOrAdmin) {
        setIsCreateOpen(false);
        showToast("لحفظ تعديلات هذا الإعلان، يرجى تسجيل الدخول بكلمة المرور المخصصة لمالك الإعلان أولاً");
        handleStartAuth('login', 'broker', (authUser) => {
          if (authUser) {
            setIsCreateOpen(true);
            submitListingWithUser(authUser);
          }
        }, targetPhone);
        return;
      }
    }

    if (!activeUser) {
      setIsCreateOpen(false);
      showToast("لتأكيد ونشر إعلانك، يرجى إنشاء حسابك أو تسجيل الدخول أولاً");
      handleStartAuth('register', 'broker', (authUser) => {
        const u = authUser || activeUser;
        if (u) {
          submitListingWithUser(u);
        }
      });
      return;
    }
    submitListingWithUser(activeUser);
  };

  const submitListingWithUser = async (currentUser) => {
    if (!currentUser || !currentUser.id) return;
    const isEditing = Boolean(editingListing && editingListing.id);
    const isAdminUser = currentUser.account_type === 'admin';
    const targetContact = createForm.contact_phone || currentUser.phone || '';

    if (!isEditing && !isAdminUser && targetContact !== (currentUser.phone || '') && !createForm.contact_verified) {
      const inputOtp = prompt(`تم إرسال كود التفعيل إلى الرقم ${targetContact}. أدخل الكود (123456):`);
      if (inputOtp !== '123456') {
        showToast('كود تفعيل رقم الهاتف للتواصل غير صحيح (الكود التجريبي: 123456)');
        return;
      }
      setCreateForm(prev => ({ ...prev, contact_verified: true }));
    }

    try {
      const isEditing = Boolean(editingListing && editingListing.id);
      showToast(isEditing ? "جاري حفظ التعديلات..." : "جاري نشر العقار...");

      const cleanedConfigs = (createForm.room_configurations || []).map(c => ({
        ...c,
        price_per_person: Number(c.price_per_person) || 0,
        commission: c.commission !== '' && c.commission !== null ? Number(c.commission) : Math.round((Number(c.price_per_person) || 0) * 0.5),
        insurance_price: c.insurance_price !== '' && c.insurance_price !== null ? Number(c.insurance_price) : 0,
        count: Number(c.count) || 1
      }));

      let payload = {
        ...createForm,
        address: createForm.full_address || createForm.address,
        room_configurations: cleanedConfigs,
        contact_phone: targetContact,
        whatsapp_phone: createForm.no_whatsapp ? (createForm.whatsapp_phone || targetContact) : targetContact,
        advertiser_id: currentUser.id
      };

      const url = isEditing ? `${API_BASE}/listings/${editingListing.id}?x_user_id=${currentUser.id}` : `${API_BASE}/listings`;
      const method = isEditing ? 'PUT' : 'POST';
      const headers = {
        'Content-Type': 'application/json',
        ...(isEditing ? { 
          'x-user-id': String(currentUser.id),
          'x_user_id': String(currentUser.id) 
        } : {})
      };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const publishedData = await res.json();
        showToast(isEditing ? "تم حفظ التعديلات بنجاح!" : "تم نشر العقار بنجاح وتفعيله على المنصة!");
        setIsCreateOpen(false);
        setEditingListing(null);
        if (isEditing && publishedData?.id) {
          openListingDetail(publishedData.id);
        } else {
          setTab('browse');
        }
        loadListings();

        if (!isEditing && publishedData) {
          setPostPublishListing(publishedData);
          setIsPostPublishModalOpen(true);
        }
      } else {
        const err = await res.json();
        showToast(err.detail || (isEditing ? "فشل حفظ التعديلات" : "فشل نشر العقار"));
      }
    } catch (err) {
      showToast("خطأ في الاتصال بالخادم أثناء نشر الإعلان");
    }
  };

  const addRoomConfig = () => {
    setCreateForm(prev => ({
      ...prev,
      room_configurations: [
        ...prev.room_configurations,
        {
          room_type: 'double',
          price_per_person: 800,
          commission_pct: 50,
          commission: 400,
          commission_type: 'fixed',
          commission_min_pct: 30,
          commission_max_pct: 100,
          commission_min: 240,
          commission_max: 800,
          count: 1,
          insurance_price: '',
          services_inclusive: false,
          has_ac: false
        }
      ]
    }));
  };

  const removeRoomConfig = (index) => {
    setCreateForm(prev => ({
      ...prev,
      room_configurations: prev.room_configurations.filter((_, idx) => idx !== index)
    }));
  };

  const updateRoomConfig = (index, field, val) => {
    setCreateForm(prev => {
      const updated = [...prev.room_configurations];
      const item = { ...updated[index], [field]: val };
      
      const price = Number(item.price_per_person) || 0;
      
      if (field === 'price_per_person') {
        const pct = item.commission_pct ?? 50;
        item.commission = Math.round(price * (pct / 100));
        
        const minPct = item.commission_min_pct ?? 30;
        const maxPct = item.commission_max_pct ?? 100;
        item.commission_min = Math.round(price * (minPct / 100));
        item.commission_max = Math.round(price * (maxPct / 100));
      } else if (field === 'commission_pct') {
        const pct = Math.max(0, Math.min(200, Number(val) || 0));
        item.commission_pct = pct;
        item.commission = Math.round(price * (pct / 100));
      } else if (field === 'commission_min_pct') {
        const minPct = Math.max(0, Math.min(200, Number(val) || 0));
        item.commission_min_pct = minPct;
        item.commission_min = Math.round(price * (minPct / 100));
      } else if (field === 'commission_max_pct') {
        const maxPct = Math.max(0, Math.min(200, Number(val) || 0));
        item.commission_max_pct = maxPct;
        item.commission_max = Math.round(price * (maxPct / 100));
      } else if (field === 'commission_type') {
        if (val === 'range') {
          item.commission_min_pct = item.commission_min_pct ?? 30;
          item.commission_max_pct = item.commission_max_pct ?? 100;
          item.commission_min = Math.round(price * (item.commission_min_pct / 100));
          item.commission_max = Math.round(price * (item.commission_max_pct / 100));
        } else {
          item.commission_pct = item.commission_pct ?? 50;
          item.commission = Math.round(price * (item.commission_pct / 100));
        }
      }

      updated[index] = item;
      return { ...prev, room_configurations: updated };
    });
  };

  const toggleAmenity = (name) => {
    setCreateForm(prev => {
      const current = [...prev.amenities];
      if (current.includes(name)) {
        return { ...prev, amenities: current.filter(x => x !== name) };
      } else {
        return { ...prev, amenities: [...current, name] };
      }
    });
  };

  const handleAddCustomAmenity = () => {
    if (!customAmenity.trim()) return;
    setCreateForm(prev => ({
      ...prev,
      amenities: [...prev.amenities, customAmenity.trim()]
    }));
    setCustomAmenity('');
  };

  // --- Submitting Rating ---
  const handleOpenRatingForm = () => {
    if (!user) {
      handleStartAuth('register', 'student', () => {
        setShowRatingForm(true);
      });
      return;
    }
    if (user.account_type !== 'student') {
      showToast("التقييمات متاحة للمستخدمين العاديين والطلاب فقط.");
      return;
    }
    setShowRatingForm(true);
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    
    if (detailRatingTab === 'advertiser' && ratingInput.review_text.trim().length < 20) {
      showToast("عذراً، يجب أن يكون التقييم الكتابي للمعلن 20 حرفاً على الأقل");
      return;
    }

    try {
      const endpoint = detailRatingTab === 'advertiser' ? 'advertiser' : 'property';
      const res = await fetch(`${API_BASE}/ratings/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: selectedListingDetail.listing.id,
          student_id: user.id,
          star_count: ratingInput.star_count,
          review_text: ratingInput.review_text,
          photo_urls: ratingInput.photo_urls
        })
      });
      if (res.ok) {
        showToast("شكراً لك! تم نشر تقييمك فوراً");
        setShowRatingForm(false);
        openListingDetail(selectedListingDetail.listing.id);
      } else {
        const err = await res.json();
        showToast(err.detail || "فشل نشر التقييم");
      }
    } catch (err) {
      showToast("خطأ في الاتصال بالخادم");
    }
  };

  // --- Submitting Complaint ---
  const handleOpenComplaintForm = () => {
    if (!user) {
      handleStartAuth('register', 'student', () => {
        setShowComplaintForm(true);
      });
      return;
    }
    if (user.account_type !== 'student') {
      showToast("تقديم البلاغات والشكاوى متاح للطلاب والمستخدمين العاديين فقط.");
      return;
    }
    setShowComplaintForm(true);
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    if (complaintInput.description.trim().length < 20) {
      showToast("يجب أن يحتوي الوصف على 20 حرفاً على الأقل لوصف المخالفة بدقة");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: selectedListingDetail.listing.id,
          student_id: user.id,
          violation_type: complaintInput.violation_type,
          description: complaintInput.description,
          evidence_urls: complaintInput.evidence_urls
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("تم استلام شكواك وسيتم مراجعتها واتخاذ الإجراءات اللازمة.");
        setShowComplaintForm(false);
        setComplaintInput({ violation_type: 'السعر المطلوب أعلى من المعلن', description: '', evidence_urls: [] });
      } else {
        showToast(data.detail || "حدث خطأ أثناء تقديم الشكوى");
      }
    } catch (err) {
      showToast("خطأ في الاتصال");
    }
  };

  // --- Advertiser Dashboard Actions ---
  const handleUpdateBeds = async (listingId, newCount) => {
    if (newCount < 0) return;
    // Cap at total beds from room configurations
    const listing = listings.find(l => l.id === listingId);
    if (listing && listing.room_configurations && listing.room_configurations.length > 0) {
      const totalBeds = listing.room_configurations.reduce((sum, c) => {
        const multiplier = c.room_type === 'double' ? 2 : c.room_type === 'triple' ? 3 : c.room_type === 'quadruple' || c.room_type === 'triple+' ? 4 : 1;
        return sum + (c.count || 1) * multiplier;
      }, 0);
      if (newCount > totalBeds) return;
    }
    try {
      const res = await fetch(`${API_BASE}/listings/${listingId}/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_beds: newCount })
      });
      if (res.ok) {
        showToast("تم تحديث عدد الأسرة بنجاح");
        loadListings();
      }
    } catch (err) {
      showToast("فشل تحديث البيانات");
    }
  };

  const handleRepublish = async (listingId, beds) => {
    try {
      const res = await fetch(`${API_BASE}/listings/${listingId}/republish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_beds: beds > 0 ? beds : 1 })
      });
      if (res.ok) {
        const republishData = await res.json();
        showToast("تم إعادة نشر الإعلان بنجاح");
        loadListings();

        if (republishData) {
          setPostPublishListing(republishData);
          setIsPostPublishModalOpen(true);
        }
      }
    } catch (err) {
      showToast("خطأ في إعادة النشر");
    }
  };

  const handleToggleStatus = async (listingId) => {
    try {
      const res = await fetch(`${API_BASE}/listings/${listingId}/toggle-status`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast("تم تغيير حالة الإعلان بنجاح");
        loadListings();
      }
    } catch (err) {
      showToast("فشل في تغيير حالة الإعلان");
    }
  };

  // --- Admin Moderation panels fetches ---
  const loadAdminData = async () => {
    let activeUser = user;
    if (!activeUser) {
      try {
        const saved = localStorage.getItem('sakan_user');
        if (saved) activeUser = JSON.parse(saved);
      } catch {}
    }
    if (!activeUser || activeUser.account_type !== 'admin') return;

    const authHeaders = {
      'x-user-id': String(activeUser.id),
      'x_user_id': String(activeUser.id)
    };

    try {
      const resC = await fetch(`${API_BASE}/admin/complaints?x_user_id=${activeUser.id}`, { headers: authHeaders });
      if (resC.ok) setAdminComplaints(await resC.json());

      const resU = await fetch(`${API_BASE}/admin/users?x_user_id=${activeUser.id}`, { headers: authHeaders });
      if (resU.ok) setAdminUsers(await resU.json());

      const resL = await fetch(`${API_BASE}/admin/listings?x_user_id=${activeUser.id}`, { headers: authHeaders });
      if (resL.ok) {
        const dataL = await resL.json();
        setAdminListings(Array.isArray(dataL) ? dataL : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadGovernorates = async () => {
    try {
      const res = await fetch(`${API_BASE}/governorates`);
      if (res.ok) {
        const data = await res.json();
        setDbGovernorates(data);
      }
    } catch {}
  };

  const loadAdminGovernorates = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/admin/governorates?x_user_id=${user.id}`);
      if (res.ok) setAdminGovernorates(await res.json());
    } catch {}
  };

  const loadAdminWaitlist = async () => {
    if (!user) return;
    try {
      const url = adminWaitlistFilterGov 
        ? `${API_BASE}/admin/waitlist?governorate_id=${adminWaitlistFilterGov}&x_user_id=${user.id}`
        : `${API_BASE}/admin/waitlist?x_user_id=${user.id}`;
      const res = await fetch(url);
      if (res.ok) setAdminWaitlistEntries(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (tab === 'admin') {
      loadAdminData();
    }
  }, [tab, adminTab, user]);

  const handleAdminAction = async (complaintId, action) => {
    try {
      const res = await fetch(`${API_BASE}/admin/complaints/${complaintId}/${action}?x_user_id=${user.id}`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast(`تم تنفيذ الإجراء (${action}) بنجاح`);
        loadAdminData();
      }
    } catch (err) {
      showToast("فشل الإجراء");
    }
  };

  const handleUserBanToggle = async (userId, currentlyBanned) => {
    try {
      const action = currentlyBanned ? 'unban' : 'ban';
      const res = await fetch(`${API_BASE}/admin/users/${userId}/${action}?x_user_id=${user.id}`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast(`تم ${currentlyBanned ? 'إلغاء حظر' : 'حظر'} المستخدم`);
        loadAdminData();
      }
    } catch (err) {
      showToast("فشل تنفيذ الإجراء");
    }
  };

  const handleListingDeactivate = async (listingId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/listings/${listingId}/deactivate?x_user_id=${user.id}`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast("تم إلغاء تفعيل العقار");
        loadAdminData();
      }
    } catch (err) {
      showToast("فشل إلغاء تفعيل العقار");
    }
  };

  const handleAdminListingReactivate = async (listingId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/listings/${listingId}/reactivate?x_user_id=${user.id}`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast("تم إعادة تفعيل العقار بنجاح (تجاوز باقة الاشتراكات)");
        loadAdminData();
      } else {
        showToast("فشل تفعيل العقار");
      }
    } catch (err) {
      showToast("فشل تفعيل العقار");
    }
  };

  const getPresetOptions = (stars) => {
    if (stars === 5) return ["نظيف جداً", "الأسعار مناسبة", "الجيران محترمون", "موقع ممتاز", "المرافق كما هو معلن"];
    if (stars >= 3) return ["نظافة مقبولة", "الموقع كويس", "بعض المرافق ناقصة", "السعر مناسب نسبياً"];
    return ["غير نظيف", "المرافق مش زي ما اتعلن", "الموقع بعيد", "السعر مش مناسب", "مشاكل في الصيانة"];
  };

  return (
    <div>
      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-brand-wrapper">
          <a href="#/browse" className="logo" onClick={(e) => { e.preventDefault(); navigateTo('#/browse'); setMobileMenuOpen(false); }}>
            سكن <span>Sakan</span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Directly Visible Mobile Header "أضف إعلانك" CTA Button */}
            {(!user || isBroker || isAdmin) && (
              <button 
                className="btn-primary mobile-nav-cta" 
                onClick={() => { handleOpenCreateFlow(); setMobileMenuOpen(false); }}
                style={{ fontWeight: 800, padding: '0.4rem 0.85rem', fontSize: '0.82rem', borderRadius: '999px', alignItems: 'center', gap: '0.3rem' }}
              >
                أضف إعلانك <Plus style={{ width: 16, height: 16 }} />
              </button>
            )}

            <button 
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <div className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <button 
            className={tab === 'browse' ? 'active-tab' : 'inactive-tab'} 
            onClick={() => { navigateTo('#/browse'); setMobileMenuOpen(false); }}
          >
            تصفح العقارات
          </button>
          
          <span className="nav-sep">|</span>

          {user && (
            <>
              <button 
                className={tab === 'saved' ? 'active-tab' : 'inactive-tab'} 
                onClick={() => { navigateTo('#/saved'); setMobileMenuOpen(false); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px', verticalAlign: 'middle', marginLeft: '0.25rem' }}>
                  <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
                </svg>
                المحفوظات
              </button>
              <span className="nav-sep">|</span>
            </>
          )}

          {(!user || user.account_type === 'student') && (
            <>
              <button 
                className={tab === 'guide' ? 'active-tab' : 'inactive-tab'} 
                onClick={() => { navigateTo('#/guide'); setMobileMenuOpen(false); }}
              >
                <span>دليل الطالب</span> <BookOpen style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: '0.25rem' }} />
              </button>
              <span className="nav-sep">|</span>
            </>
          )}

          <button 
            className={tab === 'about' ? 'active-tab' : 'inactive-tab'} 
            onClick={() => { navigateTo('#/about'); setMobileMenuOpen(false); }}
          >
            من نحن
          </button>

          <span className="nav-sep">|</span>

          <button 
            className={tab === 'terms' ? 'active-tab' : 'inactive-tab'} 
            onClick={() => { navigateTo('#/terms'); setMobileMenuOpen(false); }}
          >
            الشروط والأحكام
          </button>

          <span className="nav-sep">|</span>

          <button 
            type="button"
            className="inactive-tab" 
            onClick={() => { setIsContactModalOpen(true); setMobileMenuOpen(false); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <MessageSquare style={{ width: 15, height: 15 }} />
            <span>تواصل معنا</span>
          </button>

          {/* Create listing button accessible for Brokers, Admins, or guests */}
          {(!user || isBroker || isAdmin) && (
            <>
              <span className="nav-sep">|</span>
              <button 
                className="btn-primary nav-action-btn nav-action-btn-desktop" 
                onClick={() => { handleOpenCreateFlow(); setMobileMenuOpen(false); }}
                style={{ fontWeight: 700 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>أضف إعلانك <Plus style={{ width: 18, height: 18 }} /></span>
              </button>
            </>
          )}

          {/* Bulk import button accessible ONLY for Admins */}
          {isAdmin && (
            <>
              <span className="nav-sep">|</span>
              <button 
                className="btn-outline nav-action-btn" 
                onClick={() => { setIsBulkModalOpen(true); setBulkImportResult(null); setMobileMenuOpen(false); }}
                style={{ fontWeight: 600, fontSize: '0.8rem', padding: '0.45rem 0.75rem', background: '#f8fafc' }}
                title="استيراد وتغذية إعلانات بالجملة عبر JSON"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Upload style={{ width: 16, height: 16 }} /> استيراد بالجملة</span>
              </button>
            </>
          )}

          {/* Show dashboard to logged-in Brokers and Admins */}
          {(isBroker || isAdmin) && (
            <>
              <span className="nav-sep">|</span>
              <button 
                className={tab === 'dashboard' ? 'active-tab' : 'inactive-tab'} 
                onClick={() => { navigateTo('#/dashboard'); setMobileMenuOpen(false); }}
              >
                لوحة التحكم
              </button>
            </>
          )}

          {/* Show admin panel ONLY to logged-in Admins */}
          {isAdmin && (
            <>
              <span className="nav-sep">|</span>
              <button 
                className={tab === 'admin' ? 'active-tab' : 'inactive-tab'} 
                onClick={() => { navigateTo('#/admin'); setMobileMenuOpen(false); }}
              >
                لوحة الإشراف
              </button>
            </>
          )}

          <span className="nav-sep">|</span>

          {user ? (
            <div className="nav-user-info">
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{user.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  {isAdmin ? 'مشرف المنصة' : isBroker ? 'وسيط عقاري' : 'مستخدم عادي'}
                </div>
              </div>
              <button 
                className="btn-outline"
                onClick={() => { setUser(null); showToast("تم تسجيل الخروج"); setTab('browse'); setMobileMenuOpen(false); }}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  fontSize: '0.82rem', 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderColor: '#cbd5e1', 
                  background: '#f8fafc',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer'
                }}
              >
                <LogOut style={{ width: 14, height: 14 }} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          ) : (
            <div className="nav-auth-btns">
              <button className="btn-secondary" onClick={() => { handleStartAuth('login'); setMobileMenuOpen(false); }}>تسجيل الدخول</button>
              <button className="btn-outline" onClick={() => { handleStartAuth('register'); setMobileMenuOpen(false); }}>إنشاء حساب</button>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        
        {/* TAB 1: BROWSE LISTINGS FEED */}
        {isBrowseTab && (
          <div>
            {/* --- HERO SECTION (REVERTED TO CLASSIC LIGHT GRADIENT) --- */}
            <div className="hero-section">
              <h1 className="hero-title">ابحث عن <span>سكنك الطلابي</span> المثالي</h1>
              <p className="hero-subtitle" style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                سكنك الطلابي، من غير معاناة البحث العشوائي.
              </p>
              <button 
                type="button"
                className="btn-primary"
                onClick={() => {
                  document.getElementById('main-listings-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{
                  marginTop: '1rem', padding: '0.75rem 1.75rem', borderRadius: '12px',
                  fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
                }}
              >
                <span>تصفح العقارات الآن</span>
                <ArrowDown style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div className="main-layout" id="main-listings-section">
              {/* Sidebar Filters */}
              <aside className="filter-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <h3 style={{ margin: 0, paddingBottom: '0.25rem' }}>
                  <span>تصفية النتائج</span>
                  <button className="btn-secondary" style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }} onClick={() => setFilters({
                    governorate: '', city: '', neighborhood: '', gender: '', min_price: '', max_price: '', room_types: [], amenities: [], advertiser_type: '', max_commission: '', services_inclusive: false, has_insurance: false, fully_vacant: false, min_total_beds: '', max_total_beds: ''
                  })}>مسح الكل</button>
                </h3>
                
                {/* 1. Governorates + City/Neighborhood (2-column paired row) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                    <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>المحافظة</label>
                    <select value={filters.governorate} onChange={(e) => setFilters({ ...filters, governorate: e.target.value })} style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}>
                      <option value="">جميع المحافظات</option>
                      <optgroup label="المتاحة حالياً">
                        {dbGovernorates.filter(g => g.status === 'live').map(g => (
                          <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="قائمة الانتظار">
                        {dbGovernorates.filter(g => g.status !== 'live').map(g => (
                          <option key={g.id} value={g.name} style={{ color: '#94a3b8' }}>
                            {g.name} (قريباً)
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                    <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>المدينة / الحي</label>
                    <input 
                      type="text" 
                      placeholder="مدينة نصر، الدقي..." 
                      value={filters.neighborhood} 
                      onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                {/* 2. Gender Horizontal Toggle Chips */}
                <div className="form-group" style={{ gap: '0.25rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>النوع المسموح بالسكن</label>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[
                      { id: '', label: 'الكل' },
                      { id: 'male', label: 'طلاب' },
                      { id: 'female', label: 'طالبات' }
                    ].map(chip => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setFilters({ ...filters, gender: chip.id })}
                        style={{
                          flex: 1, padding: '0.35rem 0.4rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
                          border: filters.gender === chip.id ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                          background: filters.gender === chip.id ? 'var(--primary-light)' : '#ffffff',
                          color: filters.gender === chip.id ? 'var(--primary-dark)' : '#475569',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Advertiser Type Horizontal Toggle Chips */}
                <div className="form-group" style={{ gap: '0.25rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>صفة المعلن</label>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[
                      { id: '', label: 'الكل' },
                      { id: 'owner', label: 'مالك مباشر' },
                      { id: 'broker', label: 'وسيط' }
                    ].map(chip => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setFilters({ ...filters, advertiser_type: chip.id })}
                        style={{
                          flex: 1, padding: '0.35rem 0.4rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
                          border: filters.advertiser_type === chip.id ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                          background: filters.advertiser_type === chip.id ? 'var(--primary-light)' : '#ffffff',
                          color: filters.advertiser_type === chip.id ? 'var(--primary-dark)' : '#475569',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Monthly Price Range (2 columns with +/- steppers: +100 EGP / -50 EGP) */}
                <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>نطاق السعر الشهري (ج.م)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    
                    {/* Min Price Stepper (-50 / +100) */}
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(filters.min_price) || 0;
                          const next = Math.max(0, cur - 50);
                          setFilters({ ...filters, min_price: next === 0 ? '' : String(next) });
                        }}
                        style={{ padding: '0.35rem 0.55rem', background: '#f1f5f9', border: 'none', borderLeft: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#334155' }}
                        title="-50 ج.م"
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        placeholder="الأدنى" 
                        value={filters.min_price} 
                        onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} 
                        style={{ width: '100%', border: 'none', padding: '0.35rem 0.2rem', fontSize: '0.8rem', textAlign: 'center', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(filters.min_price) || 0;
                          const next = cur + 100;
                          setFilters({ ...filters, min_price: String(next) });
                        }}
                        style={{ padding: '0.35rem 0.55rem', background: '#f1f5f9', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#334155' }}
                        title="+100 ج.م"
                      >
                        +
                      </button>
                    </div>

                    {/* Max Price Stepper (-50 / +100) */}
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(filters.max_price) || 0;
                          const next = Math.max(0, cur - 50);
                          setFilters({ ...filters, max_price: next === 0 ? '' : String(next) });
                        }}
                        style={{ padding: '0.35rem 0.55rem', background: '#f1f5f9', border: 'none', borderLeft: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#334155' }}
                        title="-50 ج.م"
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        placeholder="الأقصى" 
                        value={filters.max_price} 
                        onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} 
                        style={{ width: '100%', border: 'none', padding: '0.35rem 0.2rem', fontSize: '0.8rem', textAlign: 'center', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(filters.max_price) || 0;
                          const next = cur + 100;
                          setFilters({ ...filters, max_price: String(next) });
                        }}
                        style={{ padding: '0.35rem 0.55rem', background: '#f1f5f9', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#334155' }}
                        title="+100 ج.م"
                      >
                        +
                      </button>
                    </div>

                  </div>
                </div>

                {/* 5. Total Bed Capacity Range (2 columns) */}
                <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>عدد الأسرة الكلي بالشقة</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input 
                      type="number" 
                      placeholder="الأدنى (1)" 
                      min="1"
                      value={filters.min_total_beds} 
                      onChange={(e) => setFilters({ ...filters, min_total_beds: e.target.value })} 
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                    />
                    <input 
                      type="number" 
                      placeholder="الأقصى (10)" 
                      min="1"
                      value={filters.max_total_beds} 
                      onChange={(e) => setFilters({ ...filters, max_total_beds: e.target.value })} 
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                {/* 6. Room Type Horizontal Chips (Converting checkboxes to 4 chips in one row) */}
                <div className="form-group" style={{ gap: '0.25rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>نوع الغرفة</label>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {[
                      { id: 'single', label: 'فردية' },
                      { id: 'double', label: 'ثنائية' },
                      { id: 'triple', label: 'ثلاثية' },
                      { id: 'quadruple', label: 'رباعية' }
                    ].map(chip => {
                      const isSelected = filters.room_types.includes(chip.id);
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            const updated = isSelected 
                              ? filters.room_types.filter(t => t !== chip.id)
                              : [...filters.room_types, chip.id];
                            setFilters({ ...filters, room_types: updated });
                          }}
                          style={{
                            flex: '1 1 22%', padding: '0.35rem 0.3rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700,
                            border: isSelected ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                            background: isSelected ? 'var(--primary-light)' : '#ffffff',
                            color: isSelected ? 'var(--primary-dark)' : '#475569',
                            cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                          }}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7. Trailing Lease Conditions (Converting stacked checkboxes to horizontal chips in one row) */}
                <div className="form-group" style={{ gap: '0.25rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>شروط ومزايا الإيجار</label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setFilters({ ...filters, services_inclusive: !filters.services_inclusive })}
                      style={{
                        flex: 1, padding: '0.35rem 0.4rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700,
                        border: filters.services_inclusive ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        background: filters.services_inclusive ? '#dcfce7' : '#ffffff',
                        color: filters.services_inclusive ? '#15803d' : '#475569',
                        cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                      }}
                    >
                      <Zap style={{ width: 13, height: 13 }} /> شامل الخدمات
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilters({ ...filters, has_insurance: !filters.has_insurance })}
                      style={{
                        flex: 1, padding: '0.35rem 0.4rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700,
                        border: filters.has_insurance ? '2px solid #d97706' : '1px solid #cbd5e1',
                        background: filters.has_insurance ? '#fef3c7' : '#ffffff',
                        color: filters.has_insurance ? '#b45309' : '#475569',
                        cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                      }}
                    >
                      <Shield style={{ width: 13, height: 13 }} /> يتطلب تأمين
                    </button>
                  </div>
                </div>

                {/* 8. Max Commission + Amenities Modal Button (2-column paired row) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', borderTop: '1px solid #dbeafe', paddingTop: '0.45rem' }}>
                  <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                    <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>أقصى عمولة (ج.م)</label>
                    <input 
                      type="number" 
                      placeholder="1000" 
                      value={filters.max_commission} 
                      onChange={(e) => setFilters({ ...filters, max_commission: e.target.value })}
                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                    <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>المرافق والخدمات</label>
                    <button 
                      type="button"
                      className="btn-outline" 
                      style={{ padding: '0.4rem 0.4rem', fontSize: '0.76rem', fontWeight: 700, width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                      onClick={() => setShowAmenitiesModal(true)}
                    >
                      {filters.amenities.length > 0 ? `المرافق (${filters.amenities.length})` : 'اختر المرافق'}
                    </button>
                  </div>
                </div>

                {filters.amenities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.1rem' }}>
                    {filters.amenities.map(a => (
                      <span key={a} style={{ fontSize: '0.7rem', background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '0.12rem 0.4rem', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '0.2rem', border: '1px solid #bfdbfe' }}>
                        {a}
                        <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setFilters(prev => ({ ...prev, amenities: prev.amenities.filter(x => x !== a) }))}>×</span>
                      </span>
                    ))}
                  </div>
                )}
              </aside>

              {/* Listings feed */}
              <section style={{ flexGrow: 1 }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="section-count" style={{ fontWeight: 700, fontSize: '0.95rem' }}>العقارات المتاحة: {sortedListings.length} إعلان</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>ترتيب حسب:</span>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--r-md)', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, background: '#ffffff', color: 'var(--text-dark)', cursor: 'pointer' }}
                    >
                      <option value="newest">الأحدث نُشراً</option>
                      <option value="oldest">الأقدم نُشراً</option>
                      <option value="price_asc">السعر: من الأقل للأعلى</option>
                      <option value="price_desc">السعر: من الأعلى للأقل</option>
                    </select>
                  </div>
                </div>

                {sortedListings.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><Search style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
                    <h3 className="empty-title">لم نجد أي نتائج تطابق بحثك</h3>
                    <p className="empty-desc">جرب مسح بعض الفلاتر أو تعديل نطاق البحث الخاص بك.</p>
                  </div>
                ) : (
                  <div className="listings-grid">
                    {sortedListings.map((item) => {
                      const coverImage = item.photo_urls && item.photo_urls.length > 0
                        ? formatImageUrl(item.photo_urls[0])
                        : "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80";

                      let totalBeds = 0;
                      let breakdown = [];
                      if (item.room_configurations && item.room_configurations.length > 0) {
                        item.room_configurations.forEach(c => {
                          let bedsPerRoom = 1;
                          let name = 'فردية';
                          if (c.room_type === 'double') { bedsPerRoom = 2; name = 'ثنائية'; }
                          else if (c.room_type === 'triple') { bedsPerRoom = 3; name = 'ثلاثية'; }
                          else if (c.room_type === 'quadruple' || c.room_type === 'triple+') { bedsPerRoom = 4; name = 'رباعية'; }
                          
                          const count = c.count || 1;
                          totalBeds += (bedsPerRoom * count);
                          breakdown.push(`${count} غرف ${name}`);
                        });
                      } else {
                        totalBeds = item.available_beds;
                      }

                      const configs = item.room_configurations || [];
                      let minPrice = item.price_per_person;
                      if (configs.length > 0) {
                        const prices = configs.map(c => c.price_per_person).filter(p => p > 0);
                        if (prices.length > 0) minPrice = Math.min(...prices);
                      }

                      const servicesInclusive = configs.some(c => c.services_inclusive);
                      const hasAc = configs.some(c => c.has_ac);
                      const hasInsurance = configs.some(c => c.insurance_price && c.insurance_price > 0);

                      // Calculate total monthly rent price of the entire unit
                      let totalUnitRent = 0;
                      if (configs.length > 0) {
                        configs.forEach(c => {
                          const roomType = c.room_type || 'single';
                          const bedsPerRoom = roomType === 'single' ? 1 : roomType === 'double' ? 2 : roomType === 'triple' ? 3 : 4;
                          const roomCount = c.count || 1;
                          const pricePerPerson = c.price_per_person || 0;
                          totalUnitRent += (roomCount * bedsPerRoom * pricePerPerson);
                        });
                      } else {
                        totalUnitRent = (item.price_per_person || 0) * (item.available_beds || 1);
                      }

                      return (
                        <article 
                          key={item.id} 
                          className="listing-card"
                          style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            cursor: 'pointer'
                          }}
                          id={`listing-card-${item.id}`}
                          onClick={() => handleCardClick(item.id)}
                        >
                          <div className="card-img-wrapper" style={{ position: 'relative' }}>
                            <img className="card-img" src={coverImage} alt={item.title} />
                            
                            <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                              <span className={`badge-gender ${item.gender === 'male' ? 'gender-male' : 'gender-female'}`}>
                                {item.gender === 'male' ? 'طلاب' : 'طالبات'}
                              </span>
                              
                              {item.tier === 'premium' && (
                                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#eff6ff', color: '#0d63ea', border: '1px solid #bfdbfe', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <Star style={{ width: 12, height: 12, color: '#f59e0b' }} /> مميز
                                </span>
                              )}
                            </div>

                            <button
                              className="bookmark-btn"
                              style={{
                                position: 'absolute', bottom: '8px', left: '8px', zIndex: 2,
                                background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '50%',
                                width: '32px', height: '32px', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                              }}
                              onClick={(e) => toggleBookmark(item.id, e)}
                              title={bookmarkedIds.includes(item.id) ? 'إزالة من المحفوظات' : 'حفظ الإعلان'}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={bookmarkedIds.includes(item.id) ? '#f59e0b' : 'none'} stroke={bookmarkedIds.includes(item.id) ? '#f59e0b' : '#64748b'} strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                              </svg>
                            </button>
                          </div>

                          <div className="card-content" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {/* Header: Title + Location & Top-Left Total Capacity Badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
                              <div>
                                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.25rem 0', lineHeight: 1.35 }}>
                                  {item.title}
                                </h2>
                                <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                                  <MapPin style={{ width: 14, height: 14, color: '#94a3b8' }} />
                                  {item.governorate}، {item.city}{item.neighborhood ? `، ${item.neighborhood}` : ''}
                                </div>
                              </div>

                              {/* Total Capacity Badge (Top-Left of Card Body) */}
                              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.35rem 0.65rem', textAlign: 'center', flexShrink: 0 }}>
                                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>السعة الإجمالية</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', marginTop: '0.1rem' }}>
                                  <Bed style={{ width: 14, height: 14, color: 'var(--primary)' }} /> {totalBeds} أسرة
                                </div>
                              </div>
                            </div>

                            {/* Focal Point 1: Hero Price Summary (Total Unit Rent as Hero) */}
                            <div style={{ background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                                <span style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--primary-dark)', letterSpacing: '-0.02em' }}>
                                  {totalUnitRent ? totalUnitRent.toLocaleString() : (minPrice ? minPrice.toLocaleString() : '---')} ج.م
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                                  / شهرياً (إيجار الشقة بالكامل)
                                </span>
                              </div>

                              {/* Inline Inclusive Services Badge */}
                              {servicesInclusive && (
                                <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.2rem 0.55rem', borderRadius: '999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Zap style={{ width: 12, height: 12 }} /> شامل الخدمات
                                </span>
                              )}
                            </div>

                            {/* Grouped Per-Room Configurations (Room Type + AC + Price + Commission) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.1rem' }}>
                              {configs && configs.length > 0 ? (
                                configs.map((config, idx) => {
                                  let typeLabel = config.room_type === 'single' ? 'غرفة فردية' : config.room_type === 'double' ? 'غرفة ثنائية' : config.room_type === 'triple' ? 'غرفة ثلاثية' : 'غرفة رباعية';
                                  const isRange = config.commission_type === 'range' || (config.commission_min && config.commission_max);

                                  return (
                                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.55rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                          <Bed style={{ width: 14, height: 14, color: 'var(--primary)' }} />
                                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                                            ({config.count || 1}) {typeLabel}
                                          </span>
                                          
                                          {/* AC Badge tied directly to THIS room */}
                                          {config.has_ac && (
                                            <span style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '0.05rem 0.4rem', borderRadius: '999px', fontWeight: 700 }}>
                                              ❄️ مكيفة
                                            </span>
                                          )}
                                        </div>

                                        {/* Room Rent Price */}
                                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                                          {config.price_per_person ? config.price_per_person.toLocaleString() : '---'} ج.م/فرد
                                        </span>
                                      </div>

                                      {/* Room Commission */}
                                      {isRange ? (
                                        <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <Briefcase style={{ width: 12, height: 12 }} />
                                          <span>عمولة: {config.commission_min} - {config.commission_max} ج.م (تفاوضي)</span>
                                        </div>
                                      ) : config.commission ? (
                                        <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <Briefcase style={{ width: 12, height: 12 }} />
                                          <span>عمولة: {config.commission} ج.م</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })
                              ) : (
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.55rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>سعر السرير</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-dark)' }}>{item.price_per_person} ج.م/فرد</span>
                                </div>
                              )}
                            </div>

                            {/* Tertiary Tier: Unit-Level Badges Row */}
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.15rem' }}>
                              {/* Advertiser Chip */}
                              <span style={{ fontSize: '0.72rem', background: item.advertiser_type === 'owner' ? '#dcfce7' : '#f1f5f9', color: item.advertiser_type === 'owner' ? '#166534' : '#334155', border: `1px solid ${item.advertiser_type === 'owner' ? '#bbf7d0' : '#cbd5e1'}`, padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <User style={{ width: 12, height: 12 }} />
                                {item.advertiser_type === 'owner' ? 'مالك مباشر (بدون عمولة)' : 'وسيط'}
                              </span>

                              {/* Verified Chip */}
                              {item.advertiser_verified && (
                                <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <ShieldCheck style={{ width: 12, height: 12 }} /> موثق من سكن
                                </span>
                              )}

                              {/* Insurance Chip */}
                              {hasInsurance && (
                                <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <Shield style={{ width: 12, height: 12 }} /> يوجد تأمين
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* TAB 2: ADVERTISER DASHBOARD */}
        {tab === 'dashboard' && (isBroker || isAdmin) && (
          <div>
            <h2 className="details-title" style={{ fontSize: '1.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
              إدارة إعلاناتي السكنية
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {listings.filter(l => l.advertiser_id === user.id).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '1rem' }}>ليس لديك أي إعلانات سكنية نشطة حتى الآن.</p>
                  <button className="btn-primary" onClick={handleOpenCreateFlow}>أضف إعلانك الأول الآن</button>
                </div>
              ) : (
                listings.filter(l => l.advertiser_id === user.id).map(item => (
                  <div key={item.id} style={{ display: 'flex', gap: '1.5rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <img 
                      src={item.photo_urls?.[0] || "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80"} 
                      style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} 
                      alt="" 
                    />
                    <div style={{ flexGrow: 1 }}>
                      <h3 style={{ fontWeight: 700 }}>{item.title}</h3>
                      <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}><MapPin style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle' }} /> {item.governorate}، {item.city}، {item.neighborhood}</p>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        <span>الحالة: <strong style={{ color: item.status === 'active' ? 'var(--primary)' : 'red' }}>
                          {item.status === 'active' ? 'نشط' : item.status === 'inactive' ? 'غير نشط' : 'محظور'}
                        </strong></span>
                        <span>الأسرة المتاحة: <strong>{item.available_beds}</strong></span>
                        <span>المشاهدات: <strong>{item.view_count || 0}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem' }}>الأسرة الشاغرة</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleUpdateBeds(item.id, item.available_beds - 1)}>-</button>
                          <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold' }}>{item.available_beds}</span>
                          <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleUpdateBeds(item.id, item.available_beds + 1)}>+</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                        <button className="btn-secondary" onClick={() => openListingDetail(item.id)}>عرض التفاصيل</button>
                        <button className="btn-primary" style={{ padding: '0.4rem 0.85rem' }} onClick={() => handleOpenEditFlow(item)}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>تعديل الإعلان <PenTool style={{ width: 14, height: 14 }} /></span>
                        </button>
                        
                        <button 
                          className="btn-outline" 
                          onClick={() => handleToggleStatus(item.id)}
                          style={{ borderColor: item.status === 'active' ? '#f87171' : '#4ade80', color: item.status === 'active' ? '#ef4444' : '#16a34a' }}
                        >
                          {item.status === 'active' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>إيقاف الإعلان <StopCircle style={{ width: 14, height: 14 }} /></span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>تفعيل الإعلان <Check style={{ width: 14, height: 14 }} /></span>
                          )}
                        </button>

                        <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: '#0f766e', fontSize: '0.75rem', fontWeight: 600, width: '100%', marginTop: '0.5rem' }}>
                          <Info style={{ width: 14, height: 14, display: 'inline', color: '#0f766e' }} /> تذكير: لا تنسَ طلب التقييم من الطلاب عند إتمام التعاقد لتحسين ترتيب إعلاناتك!
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ADMIN MODERATION PANEL */}
        {tab === 'admin' && isAdmin && (
          <div>
            <h2 className="details-title" style={{ fontSize: '1.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              لوحة الإشراف والمراقبة للمسؤولين
            </h2>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
              <button className={adminTab === 'complaints' ? 'active-tab' : 'btn-secondary'} onClick={() => setAdminTab('complaints')}>طابور الشكاوى ({adminComplaints.length})</button>
              <button className={adminTab === 'users' ? 'active-tab' : 'btn-secondary'} onClick={() => setAdminTab('users')}>إدارة المعلنين ({adminUsers.length})</button>
              <button className={adminTab === 'listings' ? 'active-tab' : 'btn-secondary'} onClick={() => setAdminTab('listings')}>جميع الوحدات ({adminListings.length})</button>
              <button className={adminTab === 'admin_listings' ? 'active-tab' : 'btn-secondary'} onClick={() => setAdminTab('admin_listings')}>إعلانات الإدارة والإستيراد ({adminListings.filter(l => l.source === 'bulk' || l.source === 'scraped' || l.source === 'api' || l.source === 'manual' || (l.source && l.source !== 'normal') || l.advertiser_id === user?.id).length})</button>
              <button className={adminTab === 'ratings' ? 'active-tab' : 'inactive-tab'} onClick={() => { setAdminTab('ratings'); loadAdminRatings(); }}>التقييمات</button>
              <button className={adminTab === 'leaderboard' ? 'active-tab' : 'inactive-tab'} onClick={() => setAdminTab('leaderboard')}>الأعلى تقييماً</button>
              <button className={adminTab === 'governorates' ? 'active-tab' : 'inactive-tab'} onClick={() => { setAdminTab('governorates'); loadAdminGovernorates(); loadAdminWaitlist(); }}>إدارة المحافظات والانتظار</button>
            </div>

            {/* 1. Complaints queue subtab */}
            {adminTab === 'complaints' && (
              <div>
                <h3>شكاوى الطلاب المستلمة</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginBottom: '1rem' }}>البلاغات المقدمة من المستخدمين حول مخالفات الإعلانات أو العمولات.</p>
                {adminComplaints.length === 0 ? (
                  <p>لا توجد شكاوى معلقة حالياً.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {adminComplaints.map((c) => (
                      <div key={c.id} style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <strong>نوع المخالفة: <span style={{ color: '#ea580c' }}>{c.violation_type}</span></strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>الحالة: {c.status}</span>
                        </div>
                        <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>{c.description}</p>
                        
                        {c.evidence_urls && c.evidence_urls.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0' }}>
                            {c.evidence_urls.map((img, idx) => (
                              <img key={idx} src={img} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} alt="أدلة إثبات" />
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                          {c.status === 'submitted' && (
                            <>
                              <button className="btn-warning" style={{ fontSize: '0.85rem' }} onClick={() => handleAdminAction(c.id, 'warn')}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>توجيه تحذير <AlertTriangle style={{ width: 14, height: 14 }} /></span></button>
                              <button className="btn-danger" style={{ fontSize: '0.85rem' }} onClick={() => handleAdminAction(c.id, 'ban')}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>حظر معلن <Ban style={{ width: 14, height: 14 }} /></span></button>
                              <button className="btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => handleAdminAction(c.id, 'dismiss')}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>حفظ الشكوى <Trash2 style={{ width: 14, height: 14 }} /></span></button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Users management subtab */}
            {adminTab === 'users' && (
              <div>
                <h3>حسابات المعلنين على المنصة</h3>
                <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder="بحث بالاسم أو رقم الهاتف..." 
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px' }}
                  />
                </div>
                <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid var(--border-color)' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>
                        <th style={{ padding: '0.75rem' }}>الاسم</th>
                        <th style={{ padding: '0.75rem' }}>رقم الهاتف</th>
                        <th style={{ padding: '0.75rem' }}>النوع</th>
                        <th style={{ padding: '0.75rem' }}>عدد المخالفات</th>
                        <th style={{ padding: '0.75rem' }}>حالة الحظر</th>
                        <th style={{ padding: '0.75rem' }}>موثق</th>
                        <th style={{ padding: '0.75rem' }}>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.filter(u => {
                        if (!adminSearch.trim()) return true;
                        const q = adminSearch.trim().toLowerCase();
                        return u.name.toLowerCase().includes(q) || u.phone.includes(q);
                      }).map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem' }}>{u.name}</td>
                          <td style={{ padding: '0.75rem' }}>{u.phone}</td>
                          <td style={{ padding: '0.75rem' }}>{u.account_type === 'broker' ? 'وسيط' : u.account_type === 'owner' ? 'مالك' : u.account_type === 'admin' ? 'مسؤول' : 'طالب'}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold', color: u.offense_count > 0 ? 'red' : 'inherit' }}>{u.offense_count}</td>
                          <td style={{ padding: '0.75rem', color: u.is_banned ? 'red' : 'green', fontWeight: 'bold' }}>{u.is_banned ? 'محظور' : 'نشط'}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <button 
                              className={u.verified_by_sakan ? 'btn-primary' : 'btn-outline'} 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_BASE}/admin/users/${u.id}/verify-sakan?x_user_id=${user.id}`, { method: 'PATCH' });
                                  if (res.ok) {
                                    showToast(u.verified_by_sakan ? 'تم إلغاء التوثيق' : 'تم توثيق المعلن');
                                  // Refresh admin users
                                  const r2 = await fetch(`${API_BASE}/admin/users?x_user_id=${user.id}`);
                                  if (r2.ok) setAdminUsers(await r2.json());
                                  }
                                } catch { showToast('خطأ'); }
                              }}
                            >
                              {u.verified_by_sakan ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>موثق <Check style={{ width: 14, height: 14 }} /></span>
                              ) : (
                                'توثيق'
                              )}
                            </button>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {u.account_type !== 'admin' && (
                              <button 
                                className={u.is_banned ? 'btn-outline' : 'btn-danger'} 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                onClick={() => handleUserBanToggle(u.id, u.is_banned)}
                              >
                                {u.is_banned ? 'إلغاء الحظر' : 'حظر دائم'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Listings management subtab */}
            {adminTab === 'listings' && (
              <div>
                <h3>إدارة إعلانات السكن النشطة وغير النشطة</h3>
                <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                  {adminListings.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', background: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                      لا توجد وحدات سكنية مضافة حالياً.
                    </div>
                  ) : (
                    adminListings.map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'white', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <strong>{l.title}</strong>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}><MapPin style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle' }} /> {l.governorate}، {l.city} | حالة الإعلان: {l.status}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => openListingDetail(l.id)}>عرض</button>
                        <button className="btn-outline" style={{ fontSize: '0.8rem', color: '#2563eb', borderColor: '#bfdbfe' }} onClick={() => handleGenerateEditLink(l.id)}>
                          أرسل رابط التعديل للمعلن
                        </button>
                        {l.status === 'active' ? (
                          <button className="btn-danger" style={{ fontSize: '0.8rem' }} onClick={() => handleListingDeactivate(l.id)}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>إلغاء تفعيل <StopCircle style={{ width: 14, height: 14 }} /></span>
                          </button>
                        ) : (
                          <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => handleAdminListingReactivate(l.id)}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>إعادة تفعيل <Check style={{ width: 14, height: 14 }} /></span>
                          </button>
                        )}
                      </div>
                    </div>
                  )))}
                </div>

                {/* WhatsApp Outreach Edit Link Modal */}
                {outreachModalData && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '600px', width: '100%', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-dark)' }}>رسالة التواصل الجاهزة عبر الواتساب</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        تم تفعيل التعديل الشامل لمرة واحدة لهذا الإعلان وتوليد كلمة المرور والرابط بنجاح.
                      </p>
                      {outreachModalData.generated_password && (
                        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: '#92400e', fontWeight: 600 }}>كلمة المرور المولدة للمعلن:</span>
                          <strong style={{ fontFamily: 'monospace', fontSize: '1rem', color: '#b45309' }}>{outreachModalData.generated_password}</strong>
                        </div>
                      )}
                      <textarea 
                        readOnly 
                        rows="8" 
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', lineHeight: 1.6, background: '#f8fafc', color: '#334155' }} 
                        value={outreachModalData.whatsapp_message} 
                      />
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn-secondary" onClick={() => setOutreachModalData(null)}>إغلاق</button>
                        <button className="btn-primary" onClick={() => { navigator.clipboard.writeText(outreachModalData.whatsapp_message); showToast('تم نسخ نص الرسالة بالكامل!'); }}>
                          نسخ الرسالة
                        </button>
                        <a 
                          href={`https://wa.me/?text=${encodeURIComponent(outreachModalData.whatsapp_message)}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn-primary"
                          style={{ background: '#22c55e', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          إرسال عبر الواتساب Direct
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3b. Admin & Bulk/Scraped Listings subtab */}
            {adminTab === 'admin_listings' && (
              <div>
                <h3>إعلانات المنصة والإدارة (المستوردة والمضافة يدوياً)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  متابعة الإعلانات التي تم رفعها عبر الاستيراد بالجملة أو كشط البيانات أو إضافتها بواسطة الإدارة، وتوليد روابط التعديل المخصصة للمعلنين.
                </p>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {adminListings.filter(l => l.source === 'bulk' || l.source === 'scraped' || l.source === 'api' || l.source === 'manual' || (l.source && l.source !== 'normal') || l.advertiser_id === user?.id).length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', background: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                      لا توجد إعلانات خاصة بالإدارة أو مستوردة بالجملة حالياً.
                    </div>
                  ) : (
                    adminListings.filter(l => l.source === 'bulk' || l.source === 'scraped' || l.source === 'api' || l.source === 'manual' || (l.source && l.source !== 'normal') || l.advertiser_id === user?.id).map(l => (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'white', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '1rem' }}>{l.title}</strong>
                            <span style={{ fontSize: '0.7rem', background: l.source === 'bulk' ? '#e0e7ff' : (l.source === 'scraped' || l.source === 'api') ? '#fef3c7' : '#dcfce7', color: l.source === 'bulk' ? '#3730a3' : (l.source === 'scraped' || l.source === 'api') ? '#b45309' : '#166534', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 700 }}>
                              {l.source === 'bulk' ? 'استيراد بالجملة' : (l.source === 'scraped' || l.source === 'api') ? 'مكشوط' : 'إضافة يدوية'}
                            </span>
                            <span style={{ fontSize: '0.7rem', background: l.full_edit_available ? '#dbeafe' : '#f1f5f9', color: l.full_edit_available ? '#1e40af' : '#64748b', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                              {l.full_edit_available ? '✓ متاح للتعديل الكامل' : 'مقفل (تعديل محدود)'}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                            <MapPin style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /> {l.governorate}، {l.city} | الأسرة الشاغرة: {l.available_beds}
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => openListingDetail(l.id)}>عرض</button>
                          <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => handleOpenEditFlow(l)}>تعديل الإعلان</button>
                          <button className="btn-outline" style={{ fontSize: '0.8rem', color: '#2563eb', borderColor: '#bfdbfe' }} onClick={() => handleGenerateEditLink(l.id)}>
                            أرسل رابط التعديل للمعلن
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 6. Governorates & Waitlist Management subtab */}
            {adminTab === 'governorates' && (
              <div>
                <h3>حالة المحافظات وقائمة الانتظار للمعلنين</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  تحكم في تفعيل المحافظات (Live vs Waitlist) ومتابعة رغبات المعلنين المسجلين حسب الفئات (Tiers).
                </p>

                {/* Section A: Governorates status table */}
                <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary)' }}>أولاً: نطاقات الخدمة التشغيلية (26 محافظة)</h4>
                <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid var(--border-color)' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>
                        <th style={{ padding: '0.75rem' }}>المحافظة</th>
                        <th style={{ padding: '0.75rem' }}>الحالة التشغيلية</th>
                        <th style={{ padding: '0.75rem' }}>عدد المسجلين بقائمة الانتظار</th>
                        <th style={{ padding: '0.75rem' }}>تغيير الحالة والتفعيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminGovernorates.map(g => (
                        <tr key={g.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{g.name}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{
                              padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                              background: g.status === 'live' ? '#dcfce7' : '#fef3c7',
                              color: g.status === 'live' ? '#15803d' : '#b45309',
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                            }}>
                              {g.status === 'live' ? (
                                <><CheckCircle style={{ width: 14, height: 14 }} /> مفعلة (Live)</>
                              ) : (
                                <><Clock style={{ width: 14, height: 14 }} /> قائمة انتظار (Waitlist Open)</>
                              )}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', fontWeight: 700 }}>{g.waitlist_count || 0} معلن</td>
                          <td style={{ padding: '0.75rem' }}>
                            <button
                              className={g.status === 'live' ? 'btn-outline' : 'btn-primary'}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                              onClick={async () => {
                                const nextStatus = g.status === 'live' ? 'waitlist_open' : 'live';
                                try {
                                  const res = await fetch(`${API_BASE}/admin/governorates/${g.id}?x_user_id=${user.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: nextStatus })
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    showToast(`تم تغيير حالة ${g.name} إلى ${nextStatus === 'live' ? 'مفعلة' : 'قائمة انتظار'}`);
                                    loadAdminGovernorates();
                                    loadGovernorates();

                                    // If flipped to live, show outreach dispatch summary modal
                                    if (data.outreach_dispatched_count > 0) {
                                      setOutreachSummaryModal({
                                        gov_name: g.name,
                                        count: data.outreach_dispatched_count,
                                        summary: data.outreach_summary
                                      });
                                    }
                                  }
                                } catch { showToast('خطأ في التحديث'); }
                              }}
                            >
                              {g.status === 'live' ? 'تحويل لقائمة انتظار' : 'تفعيل إطلاق المحافظة (Flip to Live)'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section B: Waitlist entries table */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontWeight: 700, margin: 0, color: 'var(--primary)' }}>ثانياً: مسجلو قائمة الانتظار (حسب الترتيب والفئات Tiers)</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>تصفية حسب المحافظة:</label>
                    <select
                      value={adminWaitlistFilterGov}
                      onChange={(e) => {
                        setAdminWaitlistFilterGov(e.target.value);
                        loadAdminWaitlist();
                      }}
                      style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                    >
                      <option value="">جميع المحافظات</option>
                      {adminGovernorates.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid var(--border-color)' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>
                        <th style={{ padding: '0.75rem' }}>الفئة (Tier)</th>
                        <th style={{ padding: '0.75rem' }}>الاسم</th>
                        <th style={{ padding: '0.75rem' }}>الهاتف الموثق</th>
                        <th style={{ padding: '0.75rem' }}>المحافظة والمدينة</th>
                        <th style={{ padding: '0.75rem' }}>حجم الأعمال</th>
                        <th style={{ padding: '0.75rem' }}>قناة التوثيق</th>
                        <th style={{ padding: '0.75rem' }}>تاريخ التسجيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminWaitlistEntries.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            لا توجد طلبات انتظار مسجلة في هذا النطاق.
                          </td>
                        </tr>
                      ) : (
                        adminWaitlistEntries.map(e => (
                          <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{
                                padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                                background: e.tier === 1 ? '#fef3c7' : e.tier === 2 ? '#e0e7ff' : '#f1f5f9',
                                color: e.tier === 1 ? '#b45309' : e.tier === 2 ? '#3730a3' : '#475569'
                              }}>
                                {e.tier === 1 ? 'Tier 1 (الأولى)' : e.tier === 2 ? 'Tier 2 (الثانية)' : 'Tier 3 (الثالثة)'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{e.name}</td>
                            <td style={{ padding: '0.75rem' }}>{e.phone}</td>
                            <td style={{ padding: '0.75rem' }}>{e.governorate_name} - {e.city}</td>
                            <td style={{ padding: '0.75rem' }}>{e.work_volume_range} وحدة</td>
                            <td style={{ padding: '0.75rem', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 600 }}>{e.verified_channel}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                              {new Date(e.signup_at).toLocaleDateString('ar-EG')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {adminTab === 'leaderboard' && (
              <div>
                <h3>المعلنون الأعلى تقييماً وترتيب الأداء</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>متابعة أداء المعلنين وتطور تقييماتهم على المنصة عبر الوقت.</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid var(--border-color)' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>
                        <th style={{ padding: '0.75rem' }}>المعلن</th>
                        <th style={{ padding: '0.75rem' }}>النوع</th>
                        <th style={{ padding: '0.75rem' }}>متوسط التقييم</th>
                        <th style={{ padding: '0.75rem' }}>عدد التقييمات</th>
                        <th style={{ padding: '0.75rem' }}>حالة التوثيق</th>
                        <th style={{ padding: '0.75rem' }}>الملف الشخصي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers
                        .filter(u => u.account_type === 'owner' || u.account_type === 'broker')
                        .map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{u.name}</td>
                            <td style={{ padding: '0.75rem' }}>{u.account_type === 'owner' ? 'مالك مباشر' : 'وسيط'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>★ {u.avg_rating ? u.avg_rating.toFixed(1) : 'جديد'}</span>
                            </td>
                            <td style={{ padding: '0.75rem' }}>{u.ratings_count || 0}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: u.verified_by_sakan ? '#dbeafe' : '#f1f5f9', color: u.verified_by_sakan ? '#1e40af' : 'inherit' }}>
                                {u.verified_by_sakan ? 'موثق من سكن' : 'غير موثق'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <button className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => navigateTo(`#/profile/${u.id}`)}>
                                عرض البروفايل
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {adminTab === 'ratings' && (
              <div>
                <h3>تقييمات الطلاب</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>جميع تقييمات الطلاب على المنصة. يمكنك طلب إثبات عبر واتساب وتوثيق التقييم.</p>
                {adminRatings.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>لا توجد تقييمات مسجلة.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {adminRatings.map(r => (
                      <div key={r.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {r.student_name} <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>(طالب)</span>
                              <span style={{ margin: '0 0.5rem' }}>→</span>
                              {r.advertiser_name} <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>(معلن)</span>
                            </div>
                            <div style={{ marginTop: '0.25rem' }}>
                              <span className="rating-stars">{"\u2605".repeat(r.star_count) + "\u2606".repeat(5 - r.star_count)}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginRight: '0.5rem' }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                            </div>
                            {r.review_text && <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-dark)' }}>{r.review_text}</p>}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600, background: r.is_verified ? '#dcfce7' : '#fef3c7', color: r.is_verified ? '#166534' : '#92400e' }}>
                              {r.is_verified ? 'موثق \u2713' : 'غير موثق'}
                            </span>
                            <button
                              className={r.is_verified ? 'btn-secondary' : 'btn-primary'}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_BASE}/admin/ratings/${r.id}/verify?x_user_id=${user.id}`, { method: 'PATCH' });
                                  if (res.ok) { showToast(r.is_verified ? 'تم إلغاء التوثيق' : 'تم توثيق التقييم'); loadAdminRatings(); }
                                } catch { showToast('خطأ'); }
                              }}
                            >
                              {r.is_verified ? 'إلغاء التوثيق' : 'توثيق'}
                            </button>
                            {r.student_phone && (
                              <a
                                href={`https://wa.me/${r.student_phone}?text=${encodeURIComponent(`\u0645\u0631\u062d\u0628\u0627\u064b ${r.student_name}\u060c \u0646\u0648\u062f \u0627\u0644\u062a\u0623\u0643\u062f \u0645\u0646 \u062a\u0642\u064a\u064a\u0645\u0643 \u0639\u0644\u0649 \u0645\u0646\u0635\u0629 \u0633\u0643\u0646. \u0647\u0644 \u064a\u0645\u0643\u0646\u0643 \u0625\u0631\u0633\u0627\u0644 \u0625\u062b\u0628\u0627\u062a \u0625\u0642\u0627\u0645\u062a\u0643 \u0641\u064a \u0627\u0644\u0633\u0643\u0646\u061f`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-outline"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', textDecoration: 'none' }}
                              >
                                طلب إثبات (WhatsApp)
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: SAVED BOOKMARKS */}
        {tab === 'saved' && user && (
          <div>
            <h2 className="details-title" style={{ fontSize: '1.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
              إعلاناتي المحفوظة
            </h2>
            {bookmarkedIds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ width: '48px', height: '48px', margin: '0 auto 1rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>لم تقم بحفظ أي إعلانات بعد. تصفح العقارات واضغط على أيقونة الحفظ لإضافتها هنا.</p>
              </div>
            ) : (
              <div className="listings-grid">
                {listings.filter(l => bookmarkedIds.includes(l.id)).map(item => {
                  const coverImage = item.photo_urls && item.photo_urls.length > 0
                    ? formatImageUrl(item.photo_urls[0])
                    : "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80";
                  return (
                    <article key={item.id} id={`listing-card-${item.id}`} className="listing-card" onClick={() => handleCardClick(item.id)}>
                      <div className="card-img-wrapper">
                        <img className="card-img" src={coverImage} alt={item.title} />
                        <button
                          className="bookmark-btn"
                          style={{
                            position: 'absolute', top: '8px', left: '8px', zIndex: 2,
                            background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%',
                            width: '32px', height: '32px', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                          }}
                          onClick={(e) => toggleBookmark(item.id, e)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                          </svg>
                        </button>
                      </div>
                      <div className="card-content">
                        <div className="card-location">{item.governorate}، {item.city}</div>
                        <h2 className="card-title">{item.title}</h2>
                        <div className="card-beds" style={{ fontWeight: 600 }}>الأسرة المتاحة: {item.available_beds}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STUDENT GUIDE ("دليل الطالب") */}
        {tab === 'guide' && (
          <div style={{ maxWidth: '850px', margin: '0 auto', background: 'white', borderRadius: 'var(--r-xl)', padding: '2.5rem', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h2 className="details-title" style={{ fontSize: '1.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.75rem', color: 'var(--text-dark)', fontWeight: 800 }}>
              دليل الطالب للسكن الجامعي
            </h2>
            
            <div style={{ lineHeight: '1.85', display: 'grid', gap: '1.75rem', color: '#334155' }}>
              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>1. المصروفات المتوقعة عند التعاقد</h3>
                <ul style={{ paddingRight: '1.5rem', display: 'grid', gap: '0.5rem' }}>
                  <li><strong>الإيجار الشهري:</strong> يُدفع مقدماً في بداية كل شهر.</li>
                  <li><strong>التأمين:</strong> مبلغ يُدفع مرة واحدة عند التعاقد لضمان سلامة الوحدة ومحتوياتها، ويُسترد بالكامل عند انتهاء العقد في حال عدم وجود أضرار. تأكد من تدوين قيمة التأمين في العقد كتابةً لضمان استرداده.</li>
                  <li><strong>عمولة الوسيط:</strong> تُدفع مرة واحدة عند التعاقد، وتنطبق فقط إذا كان المعلن وسيطاً وليس مالكاً مباشرة. الوحدات المعروضة من المالك مباشرة لا تتضمن أي عمولة.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>2. مدة العقد</h3>
                <p>قبل التوقيع، تأكد من مدة التعاقد المطلوبة، فقد تكون ترماً دراسياً واحداً أو سنة دراسية كاملة حسب شرط المالك. بعض الملاك يشترطون أنه في حال رغبتك بالخروج المبكر قبل نهاية المدة المتفق عليها، عليك إيجاد طالب بديل يكمل باقي مدة العقد بدلاً منك. تأكد من هذا الشرط ووضوحه في العقد قبل التوقيع لتجنب أي التزام غير متوقع لاحقاً.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>3. الخدمات المشمولة وغير المشمولة</h3>
                <p>بعض الإعلانات تكون شاملة الخدمات (الكهرباء، الغاز، المياه)، والبعض الآخر لا. تأكد دائماً من المالك أو الوسيط قبل التوقيع عما إذا كان السعر المعلن شاملاً لهذه الخدمات أم سيتطلب دفع فواتير منفصلة، لتجنب أي مفاجآت مالية لاحقة.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>4. معايير عمولة الوسيط</h3>
                <p>عمولة الوسيط قائمة على التفاوض، وتتراوح عادة بين 30% و100% من قيمة الإيجار الشهري:</p>
                <ul style={{ paddingRight: '1.5rem', display: 'grid', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <li><strong>القيمة العادلة:</strong> حوالي 50% من الإيجار الشهري.</li>
                  <li><strong>فوق 100%:</strong> تُعتبر مبالغاً فيها نوعاً ما، وفي هذه الحالة يُنصح بمعرفة الأسباب التي يستند إليها الوسيط قبل الموافقة.</li>
                </ul>
                <p style={{ marginTop: '0.5rem' }}>أي عمولة تتجاوز النطاق المتعارف عليه بشكل واضح دون تبرير مقنع يمكن الاستفسار عنها أو الإبلاغ عن الوسيط عبر آلية الإبلاغ في المنصة.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>5. آداب السكن المشترك</h3>
                <p>السكن الجامعي بيئة مشتركة تتطلب احتراماً متبادلاً. للحفاظ على تجربة مريحة للجميع:</p>
                <ul style={{ paddingRight: '1.5rem', display: 'grid', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <li>حافظ على نظافة المساحات المشتركة (المطبخ، الحمام، الصالة).</li>
                  <li>التزم بأوقات الهدوء، خاصة أثناء الامتحانات والليل.</li>
                  <li>حافظ على سلامة الأجهزة والمرافق، تجنباً لخصم قيمة الإصلاح من التأمين.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>6. قبل دفع أي مبلغ أو توقيع عقد</h3>
                <ul style={{ paddingRight: '1.5rem', display: 'grid', gap: '0.5rem' }}>
                  <li>لا تحوّل أي مبلغ، بما في ذلك العربون، قبل معاينة الوحدة شخصياً ومقابلة المالك أو الوسيط وجهاً لوجه.</li>
                  <li>تأكد من مطابقة الوحدة تماماً للصور والوصف المذكور في الإعلان (التكييف، الثلاجة، الغسالة، وحالتها الفعلية).</li>
                  <li>راجع تقييمات المعلن على المنصة، والبحث عن علامة "موثّق من سكن" كإشارة إضافية للمصداقية.</li>
                  <li>اقرأ <a href="#/terms" onClick={(e) => { e.preventDefault(); navigateTo('#/terms'); }} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>شروط الخدمة</a> لمعرفة حقوقك والتزاماتك قبل التعاقد.</li>
                </ul>
              </section>
            </div>
          </div>
        )}

        {/* TAB 5: ABOUT US ("من نحن") */}
        {tab === 'about' && (
          <div style={{ maxWidth: '850px', margin: '0 auto', background: 'white', borderRadius: 'var(--r-xl)', padding: '2.5rem', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h2 className="details-title" style={{ fontSize: '1.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.75rem', color: 'var(--text-dark)', fontWeight: 800 }}>
              من نحن: قصة منصة سكن
            </h2>
            <div style={{ lineHeight: '1.85', display: 'grid', gap: '1.75rem', color: '#334155' }}>
              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>القصة</h3>
                <p>قبل كل سنة دراسية جديدة، يواجه عشرات الآلاف من الطلاب المصريين نفس المشكلة المتكررة: البحث عن سكن مناسب في مدينة غير مدينتهم. الأدوات المتاحة حالياً، مجموعات فيسبوك وتيليجرام، عشوائية وغير منظمة، فهي بطبيعتها لا تؤدي هذا الغرض بأعلى كفاءة: إعلانات بلا تفاصيل كافية، معلن يخفي هويته أحياناً، وطالب يحتاج ينتظر رد الوسيط الذي قد يتأخر، ليجمع في النهاية معلومات كان يجب أن تكون مكتوبة في الإعلان من البداية. لكن الخسارة هنا مش على الطالب بس؛ الوسيط كمان مش بيعرف يوصل للطلاب الجادين في إطار زمني ضيق، وبيخصص وقت كبير للرد على استفسارات كتير كان ممكن تتجنب لو الأداة صح.</p>
                <p style={{ marginTop: '0.75rem' }}>بدأت سكن كمحاولة لحل هذه المشكلة من جذورها، لصالح الأطراف الثلاثة معاً. قبل بناء أي شيء، تحدثنا مباشرة مع طلاب مغتربين ووسطاء وملاك لفهم المشكلة من كل زاوية، ثم بنينا نموذج عمل يوفر على كل طرف الوقت والمجهود اللي كان بيضيع في الطرق التقليدية.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>مهمتنا</h3>
                <p>بالنسبة للطالب، توفير بيئة آمنة وشفافة تمكّنه من الوصول إلى سكن مناسب دون استغلال أو معلومات مضللة. وبالنسبة للملاك والوسطاء، توفير قناة توصلهم بعملاء جادين ومؤهلين مسبقاً، بشكل أسرع وأكفأ من الطرق العشوائية المعتادة.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>قيمنا</h3>
                <ul style={{ paddingRight: '1.5rem', display: 'grid', gap: '0.5rem' }}>
                  <li><strong>الشفافية:</strong> أسعار وعمولات وتفاصيل واضحة من البداية، بلا بنود مخفية، لصالح الطالب والوسيط معاً.</li>
                  <li><strong>الأمان والتوثيق:</strong> هوية موثقة لكل معلن، وآلية لمراجعة مصداقية التقييمات، بما يبني سمعة حقيقية للوسطاء والملاك الملتزمين.</li>
                  <li><strong>الكفاءة:</strong> عملاء مؤهلون تصل إليهم مباشرة، بدل ضياع الوقت في تواصل غير جاد.</li>
                  <li><strong>الأولوية للطالب عند التعارض:</strong> في حالات القرار الصعب، تُقاس السياسة أولاً بمصلحة الطالب، لأن ثقته هي أساس استمرار المنظومة كلها لصالح باقي الأطراف.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', marginBottom: '0.65rem', fontWeight: 800, fontSize: '1.2rem' }}>رؤيتنا</h3>
                <p>حل مشكلة السكن الطلابي في مصر بشكل نهائي، مع نمو قائم على التوسع الجغرافي في محافظات جديدة بدلاً من التوسع في مجالات أخرى.</p>
              </section>

              {/* Mobile app coming soon banner */}
              <div style={{ marginTop: '1rem', background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)', border: '1px solid #c7d2fe', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--primary)', color: 'white', padding: '0.85rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone style={{ width: 28, height: 28 }} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#1e1b4b' }}>التطبيق على الجوال قريباً</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#3730a3', fontWeight: 500 }}>
                    نعمل حالياً على إطلاق تطبيق سكن للهواتف الذكية (iOS & Android) لتجربة حجز وتواصل أسرع للطلاب والوسطاء.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: TERMS OF SERVICE ("الشروط والأحكام") */}
        {tab === 'terms' && (
          <div style={{ maxWidth: '850px', margin: '0 auto', background: 'white', borderRadius: 'var(--r-xl)', padding: '2.5rem', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h2 className="details-title" style={{ fontSize: '1.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-dark)', fontWeight: 800 }}>
              الشروط والأحكام: منصة سكن
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem', fontWeight: 600 }}>تاريخ السريان: 10 أغسطس 2026</p>

            <div style={{ lineHeight: '1.85', display: 'grid', gap: '1.75rem', color: '#334155' }}>
              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>مقدمة</h3>
                <p>سكن منصة إلكترونية تعمل كوسيط يربط بين الطلاب الباحثين عن سكن وملاك العقارات والوسطاء، بهدف تسهيل الوصول إلى وحدات سكنية مناسبة داخل النطاق الجغرافي الذي تغطيه المنصة. يشكل استخدام المنصة بأي صفة، سواء كطالب أو مالك أو وسيط، موافقة كاملة على الشروط والأحكام الواردة في هذا المستند.</p>
                <p style={{ marginTop: '0.5rem' }}>تنطبق هذه الشروط على الأطراف الثلاثة المستخدمة للمنصة، الطالب والمالك والوسيط، ويوضح كل قسم منها الحقوق والالتزامات الخاصة بكل طرف، إلى جانب الأحكام العامة التي تسري على الجميع دون استثناء.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>تعريفات</h3>
                <ul style={{ paddingRight: '1.5rem', display: 'grid', gap: '0.4rem' }}>
                  <li><strong>المنصة:</strong> يُقصد بها منصة سكن الإلكترونية بجميع صورها، بما في ذلك الموقع الإلكتروني والتطبيق وأي واجهة إلكترونية تابعة لها.</li>
                  <li><strong>المستخدم:</strong> أي شخص يستخدم المنصة بأي صفة، سواء كطالب أو مالك أو وسيط.</li>
                  <li><strong>الإعلان:</strong> أي بيان يُنشر على المنصة لعرض وحدة سكنية للإيجار.</li>
                  <li><strong>الوحدة:</strong> العقار أو الجزء منه المعروض للإيجار عبر الإعلان.</li>
                  <li><strong>المعلن:</strong> المالك أو الوسيط الذي ينشر الإعلان.</li>
                  <li><strong>التقييم:</strong> أي تقييم أو تعليق ينشره الطالب عن تجربته مع معلن معين عبر المنصة.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>أولاً: طبيعة العلاقة القانونية للمنصة</h3>
                <p>سكن منصة وسيطة تتيح النشر والتواصل، ولا تملك أي علاقة تعاقدية أو رقابية على الوسطاء أو الملاك المسجلين لديها، ولا تتحمل مسؤولية تصرفاتهم خارج النطاق الذي تتحكم فيه المنصة مباشرة. كل تعامل يتم بين الطالب والوسيط أو المالك، سواء كان تفاوضاً أو دفعاً لمبالغ مالية أو معاينة لوحدة سكنية، هو مسؤولية الطرفين المعنيين بالكامل، ولا تُعد سكن طرفاً فيه ولا ضامناً لنتائجه.</p>
                <p style={{ marginTop: '0.5rem' }}>وجود أي مالك أو وسيط على المنصة يعني التزامه بالشروط المعلنة وقت التسجيل والنشر، ولا يمثل تزكية شخصية من سكن لسلوكه أو مصداقيته.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>ثانياً: أحكام عامة تسري على جميع الأطراف</h3>
                <ul style={{ paddingRight: '1.5rem', display: 'grid', gap: '0.6rem' }}>
                  <li><strong>١. الدفع مقابل النشر:</strong> يخضع نشر الإعلانات على المنصة لنظام رسوم محدد تعلنه سكن من وقت لآخر، ويُستثنى من ذلك فترة الإطلاق التي تحددها المنصة كنافذة نشر مجاني للسماح ببناء قاعدة العرض الأولية. لا تُسترد الرسوم المدفوعة في حال حذف الإعلان بسبب مخالفة صاحبه لهذه الشروط.</li>
                  <li><strong>٢. ملكية الصور والمحتوى:</strong> يقر كل من ينشر إعلاناً على المنصة بأن الصور والبيانات المرفقة به دقيقة ومطابقة للوحدة الفعلية، وبأنه يملك الحق في نشرها. تحتفظ سكن بحق استخدام الصور والمحتوى المنشور لأغراض تسويقية متعلقة بالمنصة، دون أن يخل ذلك بملكية صاحب المحتوى الأصلية له.</li>
                  <li><strong>٣. مدة الإعلان وتجديده:</strong> يبقى الإعلان فعالاً على المنصة لمدة محددة تعلنها سكن، وبعدها يصبح غير ظاهر للبحث ما لم يقم صاحبه بتجديده. تحتفظ سكن بحق إزالة أي إعلان منتهي الصلاحية أو غير مطابق للواقع دون إشعار مسبق.</li>
                  <li><strong>٤. الخصوصية وبيانات الاتصال:</strong> تلتزم سكن بحماية بيانات المستخدمين وعدم مشاركة أرقام التواصل أو البيانات الشخصية مع أي طرف ثالث خارج غرض الوساطة الذي أُنشئت من أجله المنصة، وذلك وفقاً لأحكام قانون حماية البيانات الشخصية المصري. يتحمل كل طرف مسؤولية عدم استخدام بيانات الأطراف الأخرى التي يحصل عليها عبر المنصة في أي غرض خارج نطاق التواصل بشأن الوحدة السكنية محل الإعلان.</li>
                  <li><strong>٥. حق المنصة في التعديل:</strong> تحتفظ سكن بحق تعديل هذه الشروط والأحكام في أي وقت، وتلتزم بإخطار المستخدمين بأي تعديل جوهري عبر الوسائل المتاحة على المنصة قبل سريانه. يُعد استمرار استخدام المنصة بعد الإخطار موافقة ضمنية على التعديل.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>ثالثاً: أحكام خاصة بالمالك</h3>
                <p>يقر المالك عند نشر أي إعلان بأنه المالك الفعلي للوحدة السكنية أو مفوض رسمياً من قبل المالك للتصرف فيها، ويتحمل وحده كامل المسؤولية القانونية في حال ثبت خلاف ذلك. يقتصر دور سكن في هذا الشأن على تسجيل هذا الإقرار وقت النشر، ولا يشمل أي تحقق فعلي من سند الملكية أو التوكيل.</p>
                <p style={{ marginTop: '0.5rem' }}>يلتزم المالك بأن تكون الوحدة المعروضة مطابقة تماماً للصور والوصف المنشور على الإعلان من حيث المساحة والحالة والموقع والمرافق، بالإضافة إلى دقة كل بيان يتعلق بسعر التأمين، وما إذا كان السعر شاملاً للخدمات من عدمه، والحد الأدنى لمدة التعاقد إن وُجد. وتحتفظ سكن بحق حذف أي إعلان يثبت عدم مطابقته للواقع بناءً على بلاغ موثق من طالب.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>رابعاً: أحكام خاصة بالوسيط</h3>
                <p>يلتزم الوسيط بعرض قيمة العمولة المتفق عليها بوضوح على صفحة الإعلان قبل أي تواصل مع الطالب. تُعد هذه القيمة بنداً تعاقدياً ملزماً، ولا يجوز للوسيط طلب أي مبلغ يتجاوزها من الطالب تحت أي مسمى، سواء بشكل مباشر أو من خلال أطراف أخرى.</p>
                <p style={{ marginTop: '0.5rem' }}>في حال ثبوت مخالفة موثقة للقيمة المعلنة، بناءً على بلاغ من الطالب، تحتفظ سكن بحق حذف جميع إعلانات الوسيط المخالف وحظره نهائياً من المنصة بشكل فوري ودون إشعار مسبق، دون الحاجة لأي إجراء تحقق إضافي يتجاوز مراجعة البلاغ.</p>
                <p style={{ marginTop: '0.5rem' }}>يُحظر على الوسيط تكرار نشر الإعلان الخاص بالوحدة ذاتها أكثر من مرة بهدف زيادة ظهورها في نتائج البحث، وتحتفظ سكن بحق حذف الإعلانات المكررة دون إشعار مسبق.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>خامساً: أحكام خاصة بالطالب</h3>
                <p>يلتزم الطالب بعدم استخدام بيانات التواصل الخاصة بالمالك أو الوسيط التي يحصل عليها عبر المنصة في أي غرض تجاري أو خارج نطاق الاستفسار عن الوحدة السكنية محل الإعلان.</p>
                <p style={{ marginTop: '0.5rem' }}>يتحمل الطالب وحده مسؤولية التحقق من الوحدة السكنية ومعاينتها شخصياً أو من خلال شخص يثق فيه قبل دفع أي عربون أو مبلغ مالي، ولا تتحمل سكن أي مسؤولية عن خسارة مادية ناتجة عن تعامل مباشر بين الطالب والمالك أو الوسيط دون معاينة فعلية.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>سادساً: التقييمات والتوثيق</h3>
                <p>يتيح سكن للطالب تقييم المعلن بعد التواصل أو التعامل معه بخصوص وحدة سكنية معروضة على المنصة.</p>
                <p style={{ marginTop: '0.5rem' }}>تحتفظ سكن بالحق التقديري في مراجعة أو حذف أي تقييم يثبت أنه غير دقيق أو مسيء أو غير مرتبط بتعامل فعلي، وذلك إلى حين اعتماد المنصة لآلية محددة للتحقق من واقعة السكن الفعلي، دون أن يشكل عدم توفر هذه الآلية حالياً التزاماً على سكن بإجراء تحقق مسبق لكل تقييم.</p>
                <p style={{ marginTop: '0.5rem' }}>يُحظر على أي مستخدم نشر تقييمات وهمية، أو تقييم نفسه، أو الاستعانة بأطراف أخرى لنشر تقييمات لا تعكس تعاملاً حقيقياً مع المعلن.</p>
                <p style={{ marginTop: '0.5rem' }}>يخضع منح أو سحب علامة التوثيق لأي معلن لتقدير سكن وحدها، ولا يشكل هذا التوثيق ضماناً أو تزكية مطلقة من سكن لسلوك المعلن أو مصداقيته.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>سابعاً: آلية الإبلاغ والحظر</h3>
                <p>توفر سكن قناة إبلاغ مباشرة وسريعة تتيح للطالب الإبلاغ عن أي مخالفة، سواء كانت طلب عمولة تتجاوز القيمة المعلنة أو سلوكاً غير لائق أو معلومات غير مطابقة للواقع. تلتزم سكن بمراجعة البلاغات واتخاذ إجراء فوري عند ثبوت المخالفة، ويشمل ذلك الحظر النهائي دون إشعار مسبق للطرف المخالف.</p>
                <p style={{ marginTop: '0.5rem' }}>لا يُعد وجود آلية الإبلاغ والحظر ضماناً من سكن لنزاهة أي وسيط أو مالك، وإنما وسيلة فلترة وحماية تحسن من جودة المنصة تدريجياً، وتبقى مسؤولية الحذر الأولي قائمة على عاتق كل طرف قبل إتمام أي تعامل مالي.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>ثامناً: إنهاء الحساب</h3>
                <p>تحتفظ سكن بالحق في تعليق أو إنهاء حساب أي مستخدم، طالباً كان أو مالكاً أو وسيطاً، في حال ثبوت استخدامه للمنصة بشكل احتيالي أو مسيء أو مخالف لهذه الشروط، دون الحاجة لإشعار مسبق في حالات المخالفات الجسيمة.</p>
                <p style={{ marginTop: '0.5rem' }}>لا يعفي إنهاء الحساب المستخدم من أي التزامات مالية أو قانونية مستحقة قبل تاريخ الإنهاء.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>تاسعاً: الملكية الفكرية للمنصة</h3>
                <p>جميع الحقوق المتعلقة بالعلامة التجارية سكن، وتصميم المنصة وواجهاتها ومحتواها البرمجي، مملوكة لسكن حصراً، ولا يجوز نسخها أو إعادة استخدامها دون إذن كتابي مسبق منها.</p>
                <p style={{ marginTop: '0.5rem' }}>لا يمتد هذا الحق إلى المحتوى الذي ينشره المستخدمون من صور ووصف للوحدات، والذي يظل خاضعاً لأحكام ملكية المحتوى المنصوص عليها في القسم الثاني من هذه الشروط.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>عاشراً: تسوية النزاعات والقانون الحاكم</h3>
                <p>تخضع هذه الشروط والأحكام لأحكام القانون المصري، وأي نزاع ينشأ عن استخدام المنصة يتم حله ابتداءً عبر التواصل المباشر بين الأطراف المعنية، وتقتصر سكن على دورها كوسيط في تسهيل هذا التواصل دون إلزام قانوني بالفصل في النزاع. في حال تعذر الحل الودي، ينعقد الاختصاص القضائي للمحاكم المصرية المختصة.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>حادي عشر: إخلاء المسؤولية العام</h3>
                <p>لا تتحمل سكن أي مسؤولية عن أي خسارة مادية أو معنوية أو نزاع ينشأ عن تعامل مباشر بين الطالب والمالك أو الوسيط، بما في ذلك على سبيل المثال لا الحصر النزاعات المتعلقة بالعمولة أو حالة الوحدة السكنية أو صحة البيانات المنشورة. يقر جميع مستخدمي المنصة، بمجرد استخدامهم لها، بأنهم يتحملون هذه المسؤولية بشكل كامل ومنفرد.</p>
              </section>
            </div>
          </div>
        )}

        {/* TAB 7: PROFILE VIEW PAGE (`#/profile/:id`) */}
        {tab === 'profile' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {!profileData ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <p style={{ color: 'var(--text-muted)' }}>جاري تحميل الملف الشخصي...</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem', border: '1px solid var(--border-color)', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
                    {profileData.user.profile_photo_url ? (
                      <img src={profileData.user.profile_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <User style={{ width: 32, height: 32, color: 'var(--text-muted)' }} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontWeight: 700 }}>{profileData.user.name}</h2>
                      {profileData.user.verified_by_sakan && (
                        <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Check style={{ width: 14, height: 14 }} /> موثق من سكن
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                      {profileData.user.account_type === 'owner' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Home style={{ width: 14, height: 14 }} /> مالك عقار مباشر (بدون عمولة)</span>
                      ) : profileData.user.account_type === 'broker' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Briefcase style={{ width: 14, height: 14 }} /> وسيط عقاري</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><User style={{ width: 14, height: 14 }} /> طالب / مستخدم</span>
                      )}
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <span>عدد الإعلانات: <strong>{profileData.listings_count}</strong></span>
                      <span>متوسط التقييم: <strong style={{ color: '#f59e0b' }}>★ {profileData.avg_rating}</strong> ({profileData.ratings_received_count} تقييم)</span>
                    </div>
                    {profileData.user.phone && (
                      <a
                        href={`https://wa.me/${profileData.user.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                        style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <MessageSquare style={{ width: 16, height: 16 }} /> تواصل عبر الواتساب
                        </span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Advertiser Active Listings */}
                <div>
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>الإعلانات المعروضة ({profileData.listings.length})</h3>
                  {profileData.listings.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>لا توجد إعلانات نشطة حالياً لهذا المعلن.</p>
                  ) : (
                    <div className="listings-grid">
                      {profileData.listings.map(item => (
                        <article key={item.id} id={`listing-card-${item.id}`} className="listing-card" onClick={() => handleCardClick(item.id)}>
                          <div className="card-img-wrapper">
                            <img className="card-img" src={formatImageUrl(item.photo_urls?.[0])} alt={item.title} />
                          </div>
                          <div className="card-content">
                            <div className="card-location"><MapPin style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle' }} /> {item.city}، {item.neighborhood}</div>
                            <h2 className="card-title">{item.title}</h2>
                            <div className="card-beds">الأسرة المتاحة: {item.available_beds}</div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ratings Received */}
                {profileData.ratings_received.length > 0 && (
                  <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>تقييمات المستخدمين ({profileData.ratings_received.length})</h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {profileData.ratings_received.map(r => (
                        <div key={r.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="rating-stars">{"★".repeat(r.star_count) + "☆".repeat(5 - r.star_count)}</span>
                            {r.is_verified && <span style={{ fontSize: '0.7rem', color: '#166534', background: '#dcfce7', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>تقييم موثق <Check style={{ width: 14, height: 14, display: 'inline' }} /></span>}
                          </div>
                          {r.review_text && <p style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>{r.review_text}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* --- FOOTER COMPONENT --- */}
      <footer style={{ background: '#1e293b', color: '#f8fafc', padding: '2.5rem 1rem 1.5rem', marginTop: '3rem', borderTop: '1px solid #334155' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <h3 style={{ color: 'var(--primary)', margin: 0, marginBottom: '0.5rem', fontSize: '1.4rem' }}>سكن Sakan</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>أول منصة متكاملة في مصر لربط الطلاب المغتربين بأفضل الوحدات السكنية المتاحة بكل شفافية وأمان.</p>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '0.75rem', fontSize: '1rem' }}>روابط سريعة</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <a href="#/browse" onClick={(e) => { e.preventDefault(); navigateTo('#/browse'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>تصفح العقارات</a>
              <a href="#/guide" onClick={(e) => { e.preventDefault(); navigateTo('#/guide'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>دليل الطالب للسكن</a>
              <a href="#/about" onClick={(e) => { e.preventDefault(); navigateTo('#/about'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>من نحن (قصتنا)</a>
              <a href="#/terms" onClick={(e) => { e.preventDefault(); navigateTo('#/terms'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>الشروط والأحكام</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '0.75rem', fontSize: '1rem' }}>الدعم والتواصل</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <span>الدعم الفني: <a href="mailto:support@sakan-egy.com" style={{ color: 'var(--primary)', textDecoration: 'none' }}>support@sakan-egy.com</a></span>
              <span>واتساب الخدمة: <a href="https://wa.me/201062400034" target="_blank" rel="noreferrer" style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 600 }}>01062400034</a></span>
              <span>الشراكات والأعمال: <a href="mailto:business@sakan-egy.com" style={{ color: '#cbd5e1', textDecoration: 'none' }}>business@sakan-egy.com</a></span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #334155', paddingTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
          © {new Date().getFullYear()} منصة سكن للإسكان الطلابي في مصر. جميع الحقوق محفوظة.
        </div>
      </footer>

      {/* --- AUTHENTICATION MODAL (Arabic / Password & OTP Coexistence) --- */}
      {isAuthOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>
                {authStep === 'change_password'
                  ? 'تعيين كلمة مرور جديدة'
                  : authMode === 'register' 
                    ? (authStep === 'phone' ? 'إنشاء حساب جديد' : authStep === 'otp' ? 'رمز تحقق الحساب' : 'بيانات الحساب الإضافية')
                    : (authStep === 'phone' ? (authLoginMethod === 'password' ? 'تسجيل الدخول بكلمة المرور' : 'تسجيل الدخول بالهاتف') : 'تأكيد الرمز والدخول')
                }
              </h3>
              <button className="modal-close" onClick={() => setIsAuthOpen(false)}>×</button>
            </div>
            <div className="modal-body">

              {/* Login Method Selector Tabs (Password vs OTP) */}
              {authMode === 'login' && authStep === 'phone' && (
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                  <button 
                    type="button"
                    onClick={() => setAuthLoginMethod('password')}
                    style={{
                      flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
                      fontWeight: authLoginMethod === 'password' ? 700 : 500,
                      background: authLoginMethod === 'password' ? '#ffffff' : 'transparent',
                      color: authLoginMethod === 'password' ? 'var(--primary)' : 'var(--text-muted)',
                      boxShadow: authLoginMethod === 'password' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      fontSize: '0.85rem'
                    }}
                  >
                    كلمة المرور
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAuthLoginMethod('otp')}
                    style={{
                      flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
                      fontWeight: authLoginMethod === 'otp' ? 700 : 500,
                      background: authLoginMethod === 'otp' ? '#ffffff' : 'transparent',
                      color: authLoginMethod === 'otp' ? 'var(--primary)' : 'var(--text-muted)',
                      boxShadow: authLoginMethod === 'otp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      fontSize: '0.85rem'
                    }}
                  >
                    رمز التحقق (OTP)
                  </button>
                </div>
              )}

              {/* Step 1: Input Phone / Password */}
              {authStep === 'phone' && (
                authMode === 'login' && authLoginMethod === 'password' ? (
                  <form onSubmit={handlePasswordLoginSubmit}>
                    <div className="form-group">
                      <label>رقم الهاتف المحمول</label>
                      <input 
                        type="tel" 
                        placeholder="01xxxxxxxxx" 
                        required 
                        value={authForm.phone}
                        onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>كلمة المرور</label>
                      <input 
                        type="password" 
                        placeholder="أدخل كلمة المرور" 
                        required 
                        value={authForm.password || ''}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>تسجيل الدخول بكلمة المرور</span>
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-light)' }}>
                        ليس لديك حساب؟ <a href="#" style={{ color: 'var(--primary)', fontWeight: 'bold' }} onClick={(e) => { e.preventDefault(); setAuthMode('register'); }}>إنشاء حساب جديد</a>
                      </span>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handlePhoneSubmit}>
                    {authMode === 'register' && (
                      <div className="form-group">
                        <label>نوع حسابك</label>
                        <select value={authForm.account_type} onChange={(e) => setAuthForm({ ...authForm, account_type: e.target.value })}>
                          <option value="student">طالب / مستخدم عادي</option>
                          <option value="owner">مالك عقار (بدون عمولة)</option>
                          <option value="broker">سمسار عقاري</option>
                        </select>
                      </div>
                    )}
                    
                    <div className="form-group">
                      <label>رقم الهاتف المحمول</label>
                      <input 
                        type="tel" 
                        placeholder="01xxxxxxxxx" 
                        required 
                        value={authForm.phone}
                        onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                      {authMode === 'register' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>إرسال كود تسجيل الحساب <MessageSquare style={{ width: 16, height: 16 }} /></span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>إرسال كود تسجيل الدخول</span>
                      )}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                      {authMode === 'register' ? (
                        <span style={{ color: 'var(--text-light)' }}>
                          لديك حساب بالفعل؟ <a href="#" style={{ color: 'var(--primary)', fontWeight: 'bold' }} onClick={(e) => { e.preventDefault(); setAuthMode('login'); }}>تسجيل الدخول</a>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>
                          ليس لديك حساب؟ <a href="#" style={{ color: 'var(--primary)', fontWeight: 'bold' }} onClick={(e) => { e.preventDefault(); setAuthMode('register'); }}>إنشاء حساب جديد</a>
                        </span>
                      )}
                    </div>
                  </form>
                )
              )}

              {/* Step: Forced First-Login Password Change */}
              {authStep === 'change_password' && (
                <form onSubmit={handleChangePasswordSubmit}>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <p style={{ margin: 0, fontSize: '0.83rem', color: '#1e40af', lineHeight: 1.5 }}>
                      مرحباً بك! لأن هذه المرة الأولى لدخولك بحسابك، يرجى تعيين كلمة مرور جديدة وخاصة بك لمتابعة استخدام المنصة وطلب أو حفظ تعديلات إعلانك.
                    </p>
                  </div>

                  <div className="form-group">
                    <label>كلمة المرور الجديدة (الحد الأدنى 6 أحرف)</label>
                    <input 
                      type="password" 
                      placeholder="******" 
                      required 
                      minLength={6}
                      value={authForm.new_password || ''}
                      onChange={(e) => setAuthForm({ ...authForm, new_password: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>تأكيد كلمة المرور الجديدة</label>
                    <input 
                      type="password" 
                      placeholder="******" 
                      required 
                      minLength={6}
                      value={authForm.confirm_password || ''}
                      onChange={(e) => setAuthForm({ ...authForm, confirm_password: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.75rem' }}>
                    حفظ كلمة المرور والدخول للمنصة
                  </button>
                </form>
              )}

              {/* Step 2: Verification code */}
              {authStep === 'otp' && (
                <form onSubmit={handleOtpVerify}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                    تم إرسال كود تحقق تجريبي إلى الرقم <br /><strong>{authForm.phone}</strong>
                  </p>
                  <div className="form-group">
                    <label>كود التحقق (أدخل الكود: 123456)</label>
                    <input 
                      type="text" 
                      placeholder="xxxxxx" 
                      required 
                      value={authForm.otp}
                      onChange={(e) => setAuthForm({ ...authForm, otp: e.target.value })}
                      style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.25rem' }}
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                    {authMode === 'register' ? 'تأكيد الكود وتفعيل الحساب' : 'تحقق ودخول الحساب'}
                  </button>
                  <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setAuthStep('phone')}>تغيير الهاتف</button>
                </form>
              )}

              {/* Step 3: Broker profiles and additional info */}
              {authStep === 'details' && (
                <form onSubmit={handleDetailsSubmit}>
                  <div className="form-group">
                    <label>الاسم الكامل</label>
                    <input 
                      type="text" 
                      placeholder="اسمك بالكامل" 
                      required 
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>الصورة الشخصية (اختياري)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {/* Avatar preview */}
                      <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        border: '2px dashed var(--border)', background: 'var(--bg-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                      }} onClick={() => document.getElementById('avatar-upload-input').click()}>
                        {authForm.profile_photo_url
                          ? <img src={authForm.profile_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '1.75rem' }}><User style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ width: '100%', fontSize: '0.85rem' }}
                          onClick={() => document.getElementById('avatar-upload-input').click()}
                        >
                          {authForm.profile_photo_url ? 'تغيير الصورة' : 'رفع صورة شخصية'}
                        </button>
                        <small style={{ color: 'var(--text-light)', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>JPG أو PNG أو WEBP - حد أقصى 10 ميجابايت</small>
                      </div>
                    </div>
                    <input
                      id="avatar-upload-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append('file', file);
                        try {
                          // Upload without user_id first (we don't have one yet)
                          // The URL will be sent with the register payload
                          const objectUrl = URL.createObjectURL(file);
                          setAuthForm(prev => ({ ...prev, _avatarFile: file, profile_photo_url: objectUrl }));
                        } catch (err) {
                          showToast('خطأ في رفع الصورة');
                        }
                      }}
                    />
                  </div>

                  {user?.account_type === 'broker' && (
                    <div className="form-group">
                      <label>محافظات العمل (تحديد محافظة عمل واحدة على الأقل)</label>
                      <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        {GOVERNORATES.map(gov => {
                          const isChecked = authForm.governorates.includes(gov);
                          return (
                            <label key={gov} className="checkbox-label" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={() => {
                                  const updated = isChecked 
                                    ? authForm.governorates.filter(g => g !== gov)
                                    : [...authForm.governorates, gov];
                                  setAuthForm({ ...authForm, governorates: updated });
                                }}
                              />
                              {gov}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={user?.account_type === 'broker' && authForm.governorates.length === 0}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>حفظ واكتمال التسجيل <Save style={{ width: 16, height: 16 }} /></span></button>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- CREATE LISTING WIZARD MODAL (Arabic / 7 Steps) --- */}
      {isCreateOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>إضافة إعلان سكن طلابي جديد ({createStep} من 5)</h3>
              <button className="modal-close" onClick={() => setIsCreateOpen(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="wizard-progress">
                <div className="progress-bar-fill" style={{ width: `${(createStep - 1) * 25}%` }} />
                {[1, 2, 3, 4, 5].map(num => (
                  <span 
                    key={num} 
                    className={`wizard-step-node ${createStep === num ? 'active' : createStep > num ? 'completed' : ''}`}
                  >
                    {num}
                  </span>
                ))}
              </div>

              {/* STEP 1: TERMS AND CONDITIONS AGREEMENT */}
              {createStep === 1 && (
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '1rem' }}>اتفاقية وشروط نشر الإعلان على منصة سكن</h4>
                  <div style={{ background: '#f8fafc', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <p><strong>1.</strong> الإقرار بصحة وتحديث جميع الصور والمواصفات المدرجة للوحدة السكنية وأنها تمثل الواقع بدقة.</p>
                    <p><strong>2.</strong> عدم تغيير الأسعار أو العمولات المدونة في هذا الإعلان عند تعاقد الطلاب على أرض الواقع.</p>
                    <p><strong>3.</strong> المخالفة الأولى المثبتة تعرض حسابك لتحذير رسمي، والمخالفة الثانية حظر دائم لرقم الهاتف من المنصة.</p>
                  </div>
                  <label className="checkbox-label" style={{ fontWeight: 700 }}>
                    <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} />
                    أوافق وأتعهد بالالتزام بشروط نشر العقار المذكورة أعلاه.
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button className="btn-primary" disabled={!termsChecked} onClick={() => setCreateStep(2)}>المتابعة للخطوة التالية</button>
                  </div>
                </div>
              )}

              {/* STEP 2: BASIC INFO */}
              {createStep === 2 && (
                <div>
                  <div className="form-group">
                    <label>عنوان الإعلان</label>
                    <input 
                      type="text" 
                      placeholder="عنوان مميز (مثال: سكن شباب فاخر أمام جامعة المنيا)" 
                      value={createForm.title} 
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} 
                      required 
                    />
                  </div>

                  <div className="grid-cols-2">
                    <div className="form-group">
                      <label>المحافظة</label>
                      <select 
                        value={createForm.governorate} 
                        onChange={(e) => setCreateForm({ ...createForm, governorate: e.target.value })}
                      >
                        <option value="">اختر المحافظة...</option>
                        {GOVERNORATES.map(gov => {
                          const isLive = dbGovernorates.some(g => g.name === gov && g.status === 'live');
                          return (
                            <option key={gov} value={gov}>
                              {gov} {isLive ? '✓' : '(قائمة الانتظار)'}
                            </option>
                          );
                        })}
                      </select>
                      {(() => {
                        const selectedGov = dbGovernorates.find(g => g.name === createForm.governorate);
                        if (selectedGov && selectedGov.status === 'waitlist_open') {
                          return (
                            <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: '#c2410c', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div>تنبيه: خدمة "سكن" غير مفعلة للجمهور حالياً في محافظة <strong>{createForm.governorate}</strong>.</div>
                              <button 
                                type="button"
                                className="btn-outline" 
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderColor: '#c2410c', color: '#c2410c', width: 'fit-content' }}
                                onClick={() => {
                                  setIsCreateOpen(false);
                                  setIsAreaGateOpen(true);
                                  setAreaGateForm({ governorate_id: selectedGov.id });
                                }}
                              >
                                الانضمام لقائمة الانتظار في {createForm.governorate}
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div className="form-group">
                      <label>المدينة / المركز</label>
                      <input 
                        type="text" 
                        placeholder="مثال: أسيوط الجديدة، دمياط الجديدة..." 
                        value={createForm.city} 
                        onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>العنوان بالتفصيل <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea 
                      placeholder="ادخل العنوان بالتفاصيل (الحي والشارع ورقم المبنى)" 
                      value={createForm.full_address} 
                      onChange={(e) => setCreateForm({ ...createForm, full_address: e.target.value })} 
                      rows={2}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>الدور <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(اختياري)</span></label>
                    <input
                      type="text"
                      placeholder="مثال: الدور الثاني"
                      value={createForm.floor}
                      onChange={(e) => setCreateForm({ ...createForm, floor: e.target.value })}
                    />
                  </div>

                  {/* Map picker trigger */}
                  <div className="form-group">
                    <label>موقع العقار على الخريطة <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(اختياري)</span></label>
                    {createForm.latitude && createForm.longitude ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}><CheckCircle style={{ width: 16, height: 16, display: 'inline', color: '#16a34a' }} /> تم تحديد الموقع بنجاح</span>
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', marginRight: 'auto' }}
                          onClick={() => setShowMapPicker(true)}
                        >
                          تعديل الموقع
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem' }}
                          onClick={() => setShowMapPicker(true)}
                        >
                          <MapPin style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle' }} /> تحديد موقع العقار على الخريطة (اختياري)
                        </button>
                      </div>
                    )}
                  </div>

                  {showMapPicker && (
                    <MapPickerModal
                      cityFallback={`${createForm.city} ${createForm.governorate}`}
                      governorate={createForm.governorate}
                      initialLat={createForm.latitude}
                      initialLng={createForm.longitude}
                      onConfirm={(lat, lng) => {
                        setCreateForm(prev => ({ ...prev, latitude: lat, longitude: lng, has_precise_location: true, location_precise: true }));
                        setShowMapPicker(false);
                      }}
                      onClose={() => setShowMapPicker(false)}
                    />
                  )}

                  <div className="form-group" style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                    <label style={{ fontWeight: 700 }}>رقم الهاتف للتواصل <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input 
                      type="tel" 
                      value={createForm.contact_phone || user?.phone || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreateForm(prev => ({
                          ...prev,
                          contact_phone: val,
                          contact_verified: val === (user?.phone || '')
                        }));
                      }}
                      placeholder="01xxxxxxxxx" 
                      required 
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      افتراضياً تم إدراج رقم هاتفك الموثق ({user?.phone || 'غير مسجل'}).
                    </small>

                    <div style={{ marginTop: '0.75rem' }}>
                      <label className="checkbox-label" style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={createForm.no_whatsapp || false}
                          onChange={(e) => setCreateForm(prev => ({
                            ...prev,
                            no_whatsapp: e.target.checked,
                            whatsapp_phone: e.target.checked ? prev.whatsapp_phone : ''
                          }))}
                        />
                        لا يوجد واتساب على هذا الرقم؟
                      </label>
                    </div>

                    {createForm.no_whatsapp && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>رقم الواتساب للتواصل المباشر <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input 
                          type="tel" 
                          value={createForm.whatsapp_phone || ''} 
                          onChange={(e) => setCreateForm(prev => ({ ...prev, whatsapp_phone: e.target.value }))}
                          placeholder="01xxxxxxxxx" 
                          required={createForm.no_whatsapp}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid-cols-2">
                    <div className="form-group">
                      <label>الجنس المقبول للسكن</label>
                      <select value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}>
                        <option value="female">طالبات (بنات)</option>
                        <option value="male">طلاب (شباب)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>عدد الأسرّة الكلي المتاح حالياً</label>
                      <input 
                        type="number" 
                        value={createForm.available_beds} 
                        onChange={(e) => setCreateForm({ ...createForm, available_beds: Number(e.target.value) })} 
                        min="1" 
                        required 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifySelf: 'space-between', width: '100%', marginTop: '1rem' }}>
                    <button className="btn-secondary" onClick={() => setCreateStep(1)}>السابق</button>
                    <button className="btn-primary" disabled={!createForm.title || !createForm.city || !createForm.full_address} onClick={handleStep2Next}>التالي</button>
                  </div>
                </div>
              )}

              {/* STEP 3: ROOM CONFIGURATION, PRICING & COMMISSION */}
              {createStep === 3 && (
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>تهيئة الغرف والأسعار والعمولة</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>قم بإضافة فئات الغرف المتوفرة، تحديد الأسعار، والعمولة بشكل منظم.</p>
                  
                  {/* Minimum lease duration option */}
                  <div style={{ background: '#EFF6FF', border: '1px solid #60a5fa', borderRadius: 'var(--r-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                    <label className="checkbox-label" style={{ fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="checkbox" 
                        checked={!!createForm.min_lease_months}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, min_lease_months: e.target.checked ? 6 : null }))}
                      />
                      تحديد حد أدنى لمدة الإيجار (شرط تعاقد)
                    </label>
                    {createForm.min_lease_months && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 0.75rem', borderRadius: 'var(--r-sm)', border: '1.5px solid #3b82f6' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>الحد الأدنى (بالأشهر):</label>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.9rem', fontWeight: 800 }}
                            onClick={() => setCreateForm(prev => ({ ...prev, min_lease_months: Math.max(1, (prev.min_lease_months || 1) - 1) }))}
                          >-</button>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            min="1" 
                            max="36" 
                            value={createForm.min_lease_months} 
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setCreateForm(prev => ({ ...prev, min_lease_months: Math.max(1, Number(e.target.value) || 1) }))}
                            style={{ width: '60px', textAlign: 'center', padding: '0.35rem', borderRadius: 'var(--r-sm)', background: '#ffffff', border: '1.5px solid #94a3b8', fontWeight: 700 }}
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.9rem', fontWeight: 800 }}
                            onClick={() => setCreateForm(prev => ({ ...prev, min_lease_months: (prev.min_lease_months || 1) + 1 }))}
                          >+</button>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>أشهر</span>
                      </div>
                    )}
                  </div>

                  {createForm.room_configurations.map((config, index) => {
                    const price = Number(config.price_per_person) || 0;
                    const isRange = config.commission_type === 'range';
                    
                    return (
                      <div key={index} style={{ background: '#ffffff', border: '2px solid #cbd5e1', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'grid', gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px dashed #cbd5e1', paddingBottom: '0.5rem' }}>
                          <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>فئة غرفة #{index + 1}</strong>
                          {createForm.room_configurations.length > 1 && (
                            <button className="btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => removeRoomConfig(index)}>حذف الفئة</button>
                          )}
                        </div>
                        
                        {/* Section A: Room Type & Count Stepper */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem', color: '#1e293b' }}>نوع الغرفة</label>
                            <select 
                              value={config.room_type} 
                              onChange={(e) => updateRoomConfig(index, 'room_type', e.target.value)}
                              style={{ background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', padding: '0.45rem', fontWeight: 600, width: '100%' }}
                            >
                              <option value="single">فردية (Single)</option>
                              <option value="double">ثنائية (Double)</option>
                              <option value="triple">ثلاثية (Triple)</option>
                              <option value="quadruple">رباعية (Quadruple)</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem', color: '#1e293b' }}>عدد الغرف المتاحة</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.35rem 0.75rem', fontWeight: 800 }}
                                onClick={() => updateRoomConfig(index, 'count', Math.max(1, (config.count || 1) - 1))}
                              >-</button>
                              <input 
                                type="number" 
                                inputMode="numeric"
                                value={config.count} 
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateRoomConfig(index, 'count', Math.max(1, Number(e.target.value) || 1))} 
                                style={{ textAlign: 'center', fontWeight: 700, background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', padding: '0.45rem' }}
                                min="1" 
                              />
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.35rem 0.75rem', fontWeight: 800 }}
                                onClick={() => updateRoomConfig(index, 'count', (config.count || 1) + 1)}
                              >+</button>
                            </div>
                          </div>
                        </div>

                        {/* Section B: Pricing & Insurance */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem', color: '#1e293b' }}>الإيجار الشهري للفرد (جنيه)</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              value={config.price_per_person || ''} 
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateRoomConfig(index, 'price_per_person', e.target.value ? Number(e.target.value) : '')} 
                              placeholder="مثال: 1200"
                              style={{ background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', padding: '0.45rem 0.65rem', fontWeight: 700, width: '100%' }}
                              min="0" 
                              step="50"
                            />
                            {(!config.price_per_person || config.price_per_person <= 0) && (
                              <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, display: 'block', marginTop: '0.2rem' }}>يرجى إدخال السعر المطلوب</span>
                            )}
                          </div>

                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem', color: '#1e293b' }}>مبلغ التأمين (اختياري)</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              value={config.insurance_price || ''} 
                              onFocus={(e) => e.target.select()}
                              placeholder="مثال: 500"
                              style={{ background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', padding: '0.45rem 0.65rem', fontWeight: 600, width: '100%' }}
                              onChange={(e) => updateRoomConfig(index, 'insurance_price', e.target.value ? Number(e.target.value) : '')} 
                            />
                          </div>
                        </div>

                        {/* Section C: Commission Setup (Percentage based) */}
                        <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)' }}>عمولة الوسيط المعنية بهذه الفئة</label>
                            
                            {/* Checkbox for Fixed vs Range */}
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0369a1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <input 
                                type="checkbox"
                                checked={isRange}
                                onChange={(e) => updateRoomConfig(index, 'commission_type', e.target.checked ? 'range' : 'fixed')}
                              />
                              عمولة غير ثابتة/عمولة تقريبية
                            </label>
                          </div>

                          {!isRange ? (
                            /* Fixed Percentage Stepper */
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>نسبة العمولة من الإيجار الشهري:</span>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.9rem', fontWeight: 800 }}
                                    onClick={() => updateRoomConfig(index, 'commission_pct', Math.max(0, (config.commission_pct ?? 50) - 5))}
                                  >-</button>
                                  <input 
                                    type="number" 
                                    inputMode="numeric"
                                    value={config.commission_pct ?? 50} 
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => updateRoomConfig(index, 'commission_pct', e.target.value ? Number(e.target.value) : 0)} 
                                    style={{ width: '65px', textAlign: 'center', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', padding: '0.35rem', fontWeight: 700 }}
                                    min="0"
                                    max="200"
                                    step="5"
                                  />
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.9rem', fontWeight: 800 }}
                                    onClick={() => updateRoomConfig(index, 'commission_pct', Math.min(200, (config.commission_pct ?? 50) + 5))}
                                  >+</button>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>%</span>
                              </div>
                              
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d', marginTop: '0.35rem' }}>
                                💡 قيمة العمولة التلقائية: {config.commission ?? Math.round(price * 0.5)} جنيه {price > 0 && `(من إيجار ${price} جنيه)`}
                              </div>
                            </div>
                          ) : (
                            /* Range Percentage Steppers */
                            <div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.35rem' }}>
                                <div>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>نسبة الحد الأدنى (%):</label>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      style={{ padding: '0.2rem 0.5rem', fontWeight: 800 }}
                                      onClick={() => updateRoomConfig(index, 'commission_min_pct', Math.max(0, (config.commission_min_pct ?? 30) - 5))}
                                    >-</button>
                                    <input 
                                      type="number" 
                                      inputMode="numeric"
                                      value={config.commission_min_pct ?? 30} 
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => updateRoomConfig(index, 'commission_min_pct', e.target.value ? Number(e.target.value) : 0)} 
                                      style={{ width: '55px', textAlign: 'center', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', padding: '0.3rem', fontWeight: 700 }}
                                      min="0"
                                      max="200"
                                      step="5"
                                    />
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      style={{ padding: '0.2rem 0.5rem', fontWeight: 800 }}
                                      onClick={() => updateRoomConfig(index, 'commission_min_pct', Math.min(200, (config.commission_min_pct ?? 30) + 5))}
                                    >+</button>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>%</span>
                                  </div>
                                </div>

                                <div>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>نسبة الحد الأقصى (%):</label>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      style={{ padding: '0.2rem 0.5rem', fontWeight: 800 }}
                                      onClick={() => updateRoomConfig(index, 'commission_max_pct', Math.max(0, (config.commission_max_pct ?? 100) - 5))}
                                    >-</button>
                                    <input 
                                      type="number" 
                                      inputMode="numeric"
                                      value={config.commission_max_pct ?? 100} 
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => updateRoomConfig(index, 'commission_max_pct', e.target.value ? Number(e.target.value) : 0)} 
                                      style={{ width: '55px', textAlign: 'center', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', padding: '0.3rem', fontWeight: 700 }}
                                      min="0"
                                      max="200"
                                      step="5"
                                    />
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      style={{ padding: '0.2rem 0.5rem', fontWeight: 800 }}
                                      onClick={() => updateRoomConfig(index, 'commission_max_pct', Math.min(200, (config.commission_max_pct ?? 100) + 5))}
                                    >+</button>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>%</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', marginTop: '0.35rem' }}>
                                💡 نطاق العمولة التلقائي: {config.commission_min ?? Math.round(price * 0.3)} إلى {config.commission_max ?? price} جنيه (قابل للتفاوض)
                              </div>
                            </div>
                          )}

                          <small style={{ color: 'var(--text-light)', fontSize: '0.72rem', display: 'block', marginTop: '0.4rem' }}>
                            نسبة العمولة من الإيجار الشهري. يتم حساب وتوليد المبالغ بالجنيه تلقائياً لعرضها على الكروت وسطح الإعلان.
                          </small>
                        </div>

                        {/* Inclusive Options */}
                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input 
                              type="checkbox" 
                              checked={!!config.services_inclusive}
                              onChange={(e) => updateRoomConfig(index, 'services_inclusive', e.target.checked)} 
                            />
                            السعر شامل الفواتير (كهرباء، مياه، غاز)
                          </label>

                          <label style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0284c7' }}>
                            <input 
                              type="checkbox" 
                              checked={!!config.has_ac}
                              onChange={(e) => updateRoomConfig(index, 'has_ac', e.target.checked)} 
                            />
                            ❄️ مكيفة
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  <button className="btn-outline" onClick={addRoomConfig} style={{ width: '100%', marginBottom: '1.25rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Plus style={{ width: 16, height: 16 }} /> إضافة فئة غرفة أخرى</span>
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <button className="btn-secondary" onClick={() => setCreateStep(2)}>السابق</button>
                    <button className="btn-primary" onClick={() => setCreateStep(4)}>التالي</button>
                  </div>
                </div>
              )}

              {/* STEP 4: AMENITIES & BED COUNT */}
              {createStep === 4 && (
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>المرافق والخدمات المتوفرة</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>حدد الخدمات المتواجدة داخل الوحدة السكنية وخارجها لتسهيل وصول الباحثين إليها.</p>

                  <div className="form-group" style={{ background: '#ffffff', padding: '0.85rem 1rem', border: '1.5px solid #94a3b8', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.35rem', display: 'block' }}>إجمالي عدد الأسرة الشاغرة المتاحة حالياً</label>
                    <input 
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={createForm.available_beds === 0 ? '' : createForm.available_beds}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCreateForm({ ...createForm, available_beds: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) })}
                      placeholder="عدد الأسرة المتاحة"
                      style={{ fontWeight: 700, fontSize: '1rem', background: '#ffffff', border: '1.5px solid #94a3b8' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h5 style={{ fontWeight: 700, color: 'var(--primary)', margin: 0 }}>مرافق سكنية داخلية (Indoor)</h5>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input 
                        type="checkbox"
                        checked={INDOOR_AMENITIES.map(a => a.name).every(name => createForm.amenities.includes(name))}
                        onChange={() => {
                          const allNames = INDOOR_AMENITIES.map(a => a.name);
                          const allSelected = allNames.every(name => createForm.amenities.includes(name));
                          setCreateForm(prev => {
                            const withoutIndoor = prev.amenities.filter(a => !allNames.includes(a));
                            return { ...prev, amenities: allSelected ? withoutIndoor : [...withoutIndoor, ...allNames] };
                          });
                        }}
                      />
                      تحديد الكل
                    </label>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {INDOOR_AMENITIES.map(amenity => {
                      const isChecked = createForm.amenities.includes(amenity.name);
                      return (
                        <label key={amenity.name} className="checkbox-label" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => toggleAmenity(amenity.name)}
                          />
                          {amenity.name}
                        </label>
                      );
                    })}
                  </div>

                  <h5 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>خدمات ومحلات مجاورة (Outdoor)</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {OUTDOOR_AMENITIES.map(amenity => {
                      const isChecked = createForm.amenities.includes(amenity.name);
                      return (
                        <label key={amenity.name} className="checkbox-label" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => toggleAmenity(amenity.name)}
                          />
                          {amenity.name}
                        </label>
                      );
                    })}
                  </div>

                  <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <label>إضافة مرافق إضافية مخصصة</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="مثال: غسالة أطباق، اشتراك بين سبورت" 
                        value={customAmenity}
                        style={{ background: '#ffffff', border: '1.5px solid #94a3b8' }}
                        onChange={(e) => setCustomAmenity(e.target.value)}
                      />
                      <button type="button" className="btn-secondary" onClick={handleAddCustomAmenity}>إضافة</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '1rem' }}>
                    <button className="btn-secondary" onClick={() => setCreateStep(3)}>السابق</button>
                    <button className="btn-primary" onClick={() => setCreateStep(5)}>التالي</button>
                  </div>
                </div>
              )}

              {/* STEP 5: MEDIA & DIRECT PUBLISH */}
              {createStep === 5 && (
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>الوسائط المرئية (صور + فيديو)</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>قم برفع الصور والفيديو الخاص بالوحدة لإكمال نشر الإعلان.</p>

                  {/* Photo Upload */}
                  <div className="form-group">
                    <label>صور الوحدة - {createForm.photo_urls.length} مرفوعة (٥ كحد أدنى، ٣٠ كحد أقصى)</label>

                    {/* Thumbnail grid */}
                    {createForm.photo_urls.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {createForm.photo_urls.map((url, idx) => (
                          <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-muted)', border: idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                            <img src={formatImageUrl(url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            
                            {idx === 0 ? (
                              <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'var(--primary)', color: '#fff', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                الغلاف
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setCreateForm(prev => {
                                    const urls = [...prev.photo_urls];
                                    const [selected] = urls.splice(idx, 1);
                                    urls.unshift(selected);
                                    return { ...prev, photo_urls: urls };
                                  });
                                }}
                                style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', fontSize: '0.65rem', padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                              >
                                تعيين كغلاف
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setCreateForm(prev => ({ ...prev, photo_urls: prev.photo_urls.filter((_, i) => i !== idx) }))}
                              style={{
                                position: 'absolute', top: '4px', left: '4px',
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                                fontSize: '13px', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                              }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload drop zone */}
                    <label
                      htmlFor="listing-photo-input"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', border: '2px dashed #94a3b8',
                        borderRadius: '12px', padding: '1.5rem 1rem', cursor: 'pointer',
                        background: '#ffffff', color: 'var(--text-muted)',
                        fontSize: '0.875rem', gap: '0.4rem', transition: 'border-color 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#94a3b8'}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--primary)'; }}
                      onDragLeave={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = '#94a3b8'; }}
                      onDrop={async e => {
                        e.preventDefault(); e.stopPropagation();
                        e.currentTarget.style.borderColor = '#94a3b8';
                        const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
                        if (!files.length) return;
                        const remaining = 30 - createForm.photo_urls.length;
                        const toUpload = files.slice(0, remaining);
                        showToast(`جاري رفع ${toUpload.length} صورة...`);
                        const newUrls = [];
                        for (const file of toUpload) {
                          const fd = new FormData();
                          fd.append('file', file);
                          try {
                            const res = await fetch(`${API_BASE}/upload/listing-photo`, { method: 'POST', body: fd });
                            if (res.ok) {
                              const data = await res.json();
                              newUrls.push(formatImageUrl(data.url));
                            }
                          } catch {}
                        }
                        setCreateForm(prev => ({ ...prev, photo_urls: [...prev.photo_urls, ...newUrls] }));
                        if (newUrls.length) showToast(`تم رفع ${newUrls.length} صورة بنجاح`);
                      }}
                    >
                      <Camera style={{ width: 28, height: 28, color: 'var(--text-muted)' }} />
                      <span style={{ fontWeight: 600 }}>اضغط لرفع صور الوحدة السكنية</span>
                      <span style={{ fontSize: '0.75rem' }}>JPG, PNG, WEBP - حد أقصى 10 ميجابايت لكل صورة</span>
                      <input
                        id="listing-photo-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          const remaining = 30 - createForm.photo_urls.length;
                          const toUpload = files.slice(0, remaining);
                          showToast(`جاري رفع ${toUpload.length} صورة...`);
                          const newUrls = [];
                          for (const file of toUpload) {
                            const fd = new FormData();
                            fd.append('file', file);
                            try {
                              const res = await fetch(`${API_BASE}/upload/listing-photo`, { method: 'POST', body: fd });
                              if (res.ok) {
                                const data = await res.json();
                                newUrls.push(formatImageUrl(data.url));
                              }
                            } catch {}
                          }
                          setCreateForm(prev => ({ ...prev, photo_urls: [...prev.photo_urls, ...newUrls] }));
                          if (newUrls.length) showToast(`تم رفع ${newUrls.length} صورة بنجاح`);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {/* Device Storage Video Upload */}
                  <div className="form-group" style={{ marginTop: '1.25rem' }}>
                    <label style={{ fontWeight: 600 }}>فيديو المعاينة المرئية للوحدة السكنية</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>قم برفع فيديو من جهازك بمساحة حتى 150 ميجابايت (MP4, MOV, AVI, WEBM, MKV).</p>
                    
                    {createForm.video_urls.length > 0 && (
                      <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {createForm.video_urls.map((vurl, vidx) => (
                          <div key={vidx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#e0f2fe', color: '#0369a1', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                            <Video style={{ width: 14, height: 14 }} />
                            <span>فيديو #{vidx + 1}</span>
                            <button
                              type="button"
                              onClick={() => setCreateForm(prev => ({ ...prev, video_urls: prev.video_urls.filter((_, i) => i !== vidx) }))}
                              style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', fontWeight: 800, marginLeft: '0.25rem' }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label
                      htmlFor="listing-video-input"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        border: '1.5px dashed #0284c7', borderRadius: '10px', padding: '0.85rem 1rem',
                        cursor: 'pointer', background: '#f0f9ff', color: '#0369a1', fontSize: '0.85rem', fontWeight: 600
                      }}
                    >
                      <Video style={{ width: 18, height: 18 }} />
                      <span>اختر ملف فيديو من جهازك لرفعه</span>
                      <input
                        id="listing-video-input"
                        type="file"
                        accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 150 * 1024 * 1024) {
                            showToast('حجم الفيديو كبير جداً. الحد الأقصى 150 ميجابايت.');
                            return;
                          }
                          showToast('جاري رفع الفيديو...');
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await fetch(`${API_BASE}/upload/listing-video`, { method: 'POST', body: fd });
                            if (res.ok) {
                              const data = await res.json();
                              setCreateForm(prev => ({ ...prev, video_urls: [...prev.video_urls, formatImageUrl(data.url)] }));
                              showToast('تم رفع الفيديو بنجاح!');
                            } else {
                              const err = await res.json();
                              showToast(err.detail || 'فشل رفع الفيديو');
                            }
                          } catch {
                            showToast('خطأ أثناء رفع الفيديو');
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '1.5rem' }}>
                    <button className="btn-secondary" onClick={() => setCreateStep(4)}>السابق</button>
                    <button
                      className="btn-primary"
                      onClick={handleCreateSubmit}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>نشر الإعلان مباشرة <Send style={{ width: 16, height: 16 }} /></span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}



      {/* Amenities Filter Modal */}
      {showAmenitiesModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, margin: 0 }}>اختر المرافق المطلوبة</h3>
              <button className="modal-close" onClick={() => setShowAmenitiesModal(false)}>×</button>
            </div>
            <h5 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>مرافق داخلية</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              {INDOOR_AMENITIES.map(amenity => {
                const isChecked = filters.amenities.includes(amenity.name);
                return (
                  <label key={amenity.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.4rem', background: isChecked ? 'var(--primary-light)' : '#f8fafc', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)' }}>
                    <input type="checkbox" checked={isChecked} onChange={() => {
                      const updated = isChecked ? filters.amenities.filter(a => a !== amenity.name) : [...filters.amenities, amenity.name];
                      setFilters(prev => ({ ...prev, amenities: updated }));
                    }} />
                    {amenity.name}
                  </label>
                );
              })}
            </div>
            <h5 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>خدمات خارجية</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              {OUTDOOR_AMENITIES.map(amenity => {
                const isChecked = filters.amenities.includes(amenity.name);
                return (
                  <label key={amenity.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.4rem', background: isChecked ? 'var(--primary-light)' : '#f8fafc', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)' }}>
                    <input type="checkbox" checked={isChecked} onChange={() => {
                      const updated = isChecked ? filters.amenities.filter(a => a !== amenity.name) : [...filters.amenities, amenity.name];
                      setFilters(prev => ({ ...prev, amenities: updated }));
                    }} />
                    {amenity.name}
                  </label>
                );
              })}
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowAmenitiesModal(false)}>تطبيق الفلتر</button>
          </div>
        </div>
      )}

      {/* --- AREA SELECTION GATE MODAL (Step 1 before any listing form or sign-in) --- */}
      {isAreaGateOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>اختر نطاق الإعلان الجغرافي</h3>
              <button className="modal-close" onClick={() => setIsAreaGateOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                حدد المحافظة التي تقع بها وحدتك السكنية للتحقق من جاهزية نطاق الخدمة:
              </p>

              <div className="form-group">
                <label>المحافظة <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  value={areaGateForm.governorate_id || ''}
                  onChange={(e) => setAreaGateForm(prev => ({ ...prev, governorate_id: Number(e.target.value) }))}
                >
                  {dbGovernorates.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const selectedGov = dbGovernorates.find(g => g.id === areaGateForm.governorate_id);
                if (!selectedGov) return null;
                return selectedGov.status === 'live' ? (
                  <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: '#166534', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <span>خدمة سكن مفعلة وجاهزة استقبال الإعلانات في <strong>{selectedGov.name}</strong>.</span>
                  </div>
                ) : (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: '#92400e', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <span>خدمة سكن قادمة قريباً في <strong>{selectedGov.name}</strong>. يمكنك الانضمام لقائمة الانتظار وحجز مزايا التسجيل المبكر.</span>
                  </div>
                );
              })()}

              <button
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={!areaGateForm.governorate_id}
                onClick={() => {
                  const selectedGov = dbGovernorates.find(g => g.id === areaGateForm.governorate_id);
                  if (!selectedGov) return;
                  setIsAreaGateOpen(false);

                  if (selectedGov.status === 'live') {
                    // Live path: Proceed to 7-step full listing wizard
                    setCreateForm({
                      title: '',
                      governorate: selectedGov.name,
                      city: '',
                      neighborhood: '',
                      full_address: '',
                      address: '',
                      floor: '',
                      maps_link: '',
                      latitude: null,
                      longitude: null,
                      gender: 'female',
                      available_beds: 1,
                      room_configurations: [{ room_type: 'single', price_per_person: 1000, commission: 500, count: 1, insurance_price: '', services_inclusive: false }],
                      amenities: INDOOR_AMENITIES.filter(a => a.prechecked).map(a => a.name).concat(OUTDOOR_AMENITIES.filter(a => a.prechecked).map(a => a.name)),
                      photo_urls: [...PRESETS_PROPERTY_IMAGES],
                      video_urls: [...PRESETS_PROPERTY_VIDEOS],
                      description: '',
                      tier: 'regular',
                      min_lease_months: null
                    });
                    setShowMapPicker(false);
                    setIsCreateOpen(true);
                    setCreateStep(1);
                    setTermsChecked(false);
                  } else {
                    // Waitlist path: Proceed to Waitlist Submission Wizard (listing flow NEVER opens)
                    setWaitlistForm({
                      governorate_id: selectedGov.id,
                      governorate_name: selectedGov.name,
                      city: '',
                      name: user?.name || '',
                      phone: user?.phone || '',
                      work_volume_range: '1-4',
                      verified_channel: 'whatsapp',
                      otp: ''
                    });
                    setWaitlistStep('form');
                    setIsWaitlistOpen(true);
                  }
                }}
              >
                استمرار المتابعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- WAITLIST SUBMISSION WIZARD MODAL (Step 2b) --- */}
      {isWaitlistOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>تسجيل رغبة / انضمام لقائمة الانتظار للمعلنين</h3>
              <button className="modal-close" onClick={() => setIsWaitlistOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              
              {/* STEP 1: FORM */}
              {waitlistStep === 'form' && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!waitlistForm.phone.trim() || !waitlistForm.name.trim() || !waitlistForm.city.trim()) {
                    showToast('يرجى ملء جميع الحقول المطلوبة (الاسم، الهاتف، المدينة)');
                    return;
                  }
                  setWaitlistStep('otp');
                }}>
                  <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: '#c2410c', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    <strong>تنبيه نطاق الخدمة:</strong> خدمة "سكن" غير مفعلة للجمهور حالياً في محافظة <strong>{waitlistForm.governorate_name}</strong>. انضم لقائمة الانتظار المبكرة مجاناً واحصل على مزايا الفئات الخاصة فور الإطلاق.
                  </div>

                  <div className="form-group">
                    <label>الاسم بالكامل <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="text"
                      value={waitlistForm.name}
                      onChange={(e) => setWaitlistForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="اسمك الثلاثي"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>رقم الهاتف <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="tel"
                      value={waitlistForm.phone}
                      onChange={(e) => setWaitlistForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="01xxxxxxxxx"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>المدينة / المركز <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="text"
                      value={waitlistForm.city}
                      onChange={(e) => setWaitlistForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="مثال: أسيوط الجديدة، شربين، بنها..."
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>حجم وحدات الأعمال / المحفظة السكنية <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select
                      value={waitlistForm.work_volume_range}
                      onChange={(e) => setWaitlistForm(prev => ({ ...prev, work_volume_range: e.target.value }))}
                    >
                      <option value="1-4">من 1 إلى 4 وحدات (مالك / سمسار صغير)</option>
                      <option value="5-9">من 5 إلى 9 وحدات (سمسار متوسط)</option>
                      <option value="10-19">من 10 إلى 19 وحدة (مكتب عقارات)</option>
                      <option value="20+">أكثر من 20 وحدة (شركة / محفظة كبرى)</option>
                    </select>
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                    إرسال كود التحقق وانضمام للقائمة
                  </button>
                </form>
              )}

              {/* STEP 2: OTP VERIFICATION */}
              {waitlistStep === 'otp' && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (waitlistForm.otp !== '123456') {
                    showToast('كود التحقق غير صحيح، الكود التجريبي هو 123456');
                    return;
                  }
                  try {
                    const res = await fetch(`${API_BASE}/waitlist`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        phone: waitlistForm.phone,
                        name: waitlistForm.name,
                        governorate_id: waitlistForm.governorate_id,
                        city: waitlistForm.city,
                        work_volume_range: waitlistForm.work_volume_range,
                        verified_channel: 'whatsapp'
                      })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setWaitlistResult(data);
                      setWaitlistStep('success');
                      loadGovernorates();
                    } else {
                      const errData = await res.json();
                      showToast(errData.detail || 'خطأ في تسجيل قائمة الانتظار');
                    }
                  } catch {
                    showToast('فشل الاتصال بالخادم');
                  }
                }}>
                  <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    تم إرسال كود التحقق إلى الرقم <strong>{waitlistForm.phone}</strong> (التحقق التلقائي عبر Akedly)
                  </p>
                  <div className="form-group">
                    <label>كود التحقق (أدخل الكود التجريبي: 123456)</label>
                    <input
                      type="text"
                      placeholder="123456"
                      value={waitlistForm.otp}
                      onChange={(e) => setWaitlistForm(prev => ({ ...prev, otp: e.target.value }))}
                      style={{ textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.2rem' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                    تأكيد الانضمام للقائمة
                  </button>
                  <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setWaitlistStep('form')}>
                    تعديل البيانات
                  </button>
                </form>
              )}

              {/* STEP 3: SUCCESS & TIER BADGE */}
              {waitlistStep === 'success' && waitlistResult && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <CheckCircle style={{ width: 32, height: 32 }} />
                  </div>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>تم انضمامك لقائمة الانتظار بنجاح!</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    محافظة <strong>{waitlistResult.governorate_name}</strong> ({waitlistResult.city})
                  </p>

                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>تصنيف أسبقية التسجيل:</span>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        background: waitlistResult.tier === 1 ? '#fef3c7' : waitlistResult.tier === 2 ? '#e0e7ff' : '#f1f5f9',
                        color: waitlistResult.tier === 1 ? '#b45309' : waitlistResult.tier === 2 ? '#3730a3' : '#475569',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        <Award style={{ width: 16, height: 16 }} />
                        {waitlistResult.tier === 1 ? 'Tier 1 (الفئة الأولى - الأولوية القصوى)' : waitlistResult.tier === 2 ? 'Tier 2 (الفئة الثانية - أولوية ممتازة)' : 'Tier 3 (الفئة الثالثة - مسجل برغبة)'}
                      </span>
                    </div>
                    <ul style={{ fontSize: '0.85rem', color: 'var(--text-main)', paddingRight: '1.2rem', margin: 0, lineHeight: 1.6 }}>
                      <li>تثبيت أولوية تمييز إعلاناتك وترتيب الظهور فور إطلاق الخدمة بالمحافظة.</li>
                      <li>فترة تجريبية مجانية وخصومات خاصة للمسجلين المبكرين.</li>
                      <li>سيتم التواصل فوراً مع رقمك عند جاهزية إطلاق المنصة في نطاقك.</li>
                    </ul>
                  </div>

                  <button className="btn-primary" style={{ width: '100%' }} onClick={() => setIsWaitlistOpen(false)}>
                    إغلاق
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- OUTREACH DISPATCH SUMMARY MODAL --- */}
      {outreachSummaryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>تفعيل المحافظة وإرسال رسائل الإطلاق</h3>
              <button className="modal-close" onClick={() => setOutreachSummaryModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                تم تغيير حالة محافظة <strong>{outreachSummaryModal.gov_name}</strong> إلى <strong>مفعلة (Live)</strong>.
                تم إرسال إشعارات التفعيل لـ <strong>{outreachSummaryModal.count} معلن</strong> مسجل بقائمة الانتظار حسب الفئات Tiers:
              </p>

              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', background: '#f8fafc', fontSize: '0.8rem' }}>
                {outreachSummaryModal.summary.map(item => (
                  <div key={item.entry_id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>{item.name} ({item.phone})</span>
                      <span style={{ color: item.tier === 1 ? '#b45309' : '#3730a3' }}>Tier {item.tier} [{item.channel}]</span>
                    </div>
                    <p style={{ color: 'var(--text-light)', margin: '0.2rem 0 0', fontSize: '0.75rem' }}>{item.outreach_message}</p>
                  </div>
                ))}
              </div>

              <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setOutreachSummaryModal(null)}>
                حسناً، تم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BULK ADD LISTINGS MODAL --- */}
      {isBulkModalOpen && isAdmin && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3><Upload style={{ width: 18, height: 18, display: 'inline', verticalAlign: 'middle', marginLeft: '0.25rem' }} /> إضافة / استيراد إعلانات بالجملة (Bulk Import)</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                قم بلصق بيانات JSON الخاصة بالإعلانات (التي تم استخراجها من الـ Scraper) أو اختر ملف <code>.json</code> مباشرة لاستيرادها دفعة واحدة إلى المنصة.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <button 
                  className="btn-outline" 
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => {
                    const sample = [
                      {
                        "title": "شقة مفروشة للطلاب بالدقي بالقرب من جامعة القاهرة",
                        "governorate": "الجيزة",
                        "city": "الجيزة",
                        "neighborhood": "الدقي",
                        "full_address": "الجيزة، الدقي، شارع التحرير، عمارة 14، شقة 2، الدور 3",
                        "maps_link": "https://maps.google.com/?q=30.0381,31.2118",
                        "latitude": 30.0381,
                        "longitude": 31.2118,
                        "gender": "male",
                        "available_beds": 4,
                        "contact_phone": "01012345678",
                        "whatsapp_phone": "01012345678",
                        "min_lease_months": 3,
                        "tier": "regular",
                        "description": "شقة 3 غرف مفروشة بالكامل بالقرب من جامعة القاهرة وبجوار محطة مترو الدقي.",
                        "room_configurations": [
                          { "room_type": "single", "count": 2, "price_per_person": 2500, "commission": 1250, "insurance_price": 2500, "services_inclusive": false }
                        ],
                        "amenities": ["تكييف", "واي فاي مجاني", "سخان مياه", "غسالة", "قريب من الجامعة", "سوبر ماركت"],
                        "photo_urls": ["https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80"]
                      }
                    ];
                    setBulkJsonText(JSON.stringify(sample, null, 2));
                  }}
                >
                  إدراج نموذج تجريبي (Sample JSON)
                </button>

                <label className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                  رفع ملف JSON 📁
                  <input 
                    type="file" 
                    accept=".json,application/json" 
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => setBulkJsonText(evt.target.result);
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>

              <div className="form-group">
                <textarea 
                  rows={10} 
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', direction: 'ltr', textAlign: 'left', background: '#f8fafc' }}
                  value={bulkJsonText}
                  onChange={(e) => setBulkJsonText(e.target.value)}
                  placeholder="[ { 'governorate': 'أسيوط', 'city': 'أسيوط', ... } ]"
                />
              </div>

              {bulkImportResult && (
                <div style={{ background: bulkImportResult.failed_count > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${bulkImportResult.failed_count > 0 ? '#ffedd5' : '#bbf7d0'}`, padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <strong style={{ color: bulkImportResult.failed_count > 0 ? '#c2410c' : '#15803d', fontSize: '0.9rem' }}>
                    نتيجة الاستيراد: تم إضافة {bulkImportResult.created_count} إعلان بنجاح إلى قاعدة البيانات!
                  </strong>
                  {bulkImportResult.failed_count > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#9a3412' }}>
                      تعذر إضافة {bulkImportResult.failed_count} عنصر بسبب أخطاء التنسيق:
                      <ul style={{ paddingRight: '1.2rem', marginTop: '0.25rem', marginBottom: 0 }}>
                        {bulkImportResult.errors.map((err, i) => (
                          <li key={i}>العنصر #{err.index + 1} ({err.title}): {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn-secondary" onClick={() => setIsBulkModalOpen(false)}>إغلاق</button>
                <button className="btn-primary" disabled={isBulkLoading || !bulkJsonText.trim()} onClick={handleBulkSubmit}>
                  {isBulkLoading ? 'جاري الاستيراد...' : 'تأكيد واستيراد الإعلانات'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- POST-PUBLISH SHARE MODAL REWORK --- */}
      {isPostPublishModalOpen && postPublishListing && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center', padding: '2rem 1.5rem', borderRadius: '20px' }}>
            <div style={{ background: '#dcfce7', color: '#10b981', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <CheckCircle style={{ width: 36, height: 36, color: '#10b981' }} />
            </div>

            <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
              إعلانك جاهز الآن
            </h3>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
              يمكنك مشاركة إعلانك مباشرة على المجموعات والقنوات لوصول أسرع للطلاب.
            </p>

            {/* Visual Message Bubble Preview Box */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '16px',
              padding: '0.9rem 1.15rem',
              marginBottom: '1.5rem',
              textAlign: 'right',
              color: '#0f172a',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontWeight: 800, fontSize: '0.78rem', marginBottom: '0.4rem', borderBottom: '1px solid #dcfce7', paddingBottom: '0.35rem' }}>
                <MessageSquare style={{ width: 14, height: 14, color: '#16a34a' }} />
                <span>معاينة نص الإعلان الجاهز للمشاركة:</span>
              </div>
              <pre style={{
                fontFamily: 'inherit',
                whiteSpace: 'pre-wrap',
                margin: 0,
                fontSize: '0.82rem',
                color: '#1e293b',
                fontWeight: 600,
                lineHeight: 1.6
              }}>
                {formatUnifiedShareText(postPublishListing)}
              </pre>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                className="btn-outline" 
                style={{ padding: '0.65rem 1.25rem', fontWeight: 600, borderRadius: '12px' }}
                onClick={() => {
                  setIsPostPublishModalOpen(false);
                  setPostPublishListing(null);
                }}
              >
                لاحقاً
              </button>

              <button 
                className="btn-primary" 
                style={{ padding: '0.65rem 1.5rem', fontWeight: 800, borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={async () => {
                  const shareText = formatUnifiedShareText(postPublishListing);
                  const shareUrl = `https://sakan-egy.com/listings/${postPublishListing.id}`;
                  
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: postPublishListing.title,
                        text: shareText,
                        url: shareUrl
                      });
                      showToast('تمت مشاركة الإعلان بنجاح!');
                    } catch (err) {
                      if (err.name !== 'AbortError' && navigator.clipboard) {
                        await navigator.clipboard.writeText(shareText);
                        showToast('تم نسخ نص الإعلان جاهزاً للمشاركة!');
                      }
                    }
                  } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareText);
                    showToast('تم نسخ نص الإعلان جاهزاً للمشاركة!');
                  }
                  setIsPostPublishModalOpen(false);
                  setPostPublishListing(null);
                }}
              >
                <Share2 style={{ width: 18, height: 18 }} /> مشاركة الإعلان
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- FLOATING MOBILE FILTER FAB --- */}
      {tab === 'browse' && (
        <button 
          className="mobile-filter-fab"
          style={{
            position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 900,
            background: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '999px',
            padding: '0.65rem 1.4rem', fontWeight: 800, fontSize: '0.9rem', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'
          }}
          onClick={() => setIsMobileFilterOpen(true)}
        >
          <Search style={{ width: 18, height: 18 }} /> تصفية النتائج ({sortedListings.length})
        </button>
      )}

      {/* --- MOBILE FILTER DRAWER MODAL --- */}
      {isMobileFilterOpen && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div className="modal-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 800, margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Search style={{ width: 20, height: 20, color: 'var(--primary)' }} /> تصفية نتائج البحث
              </h3>
              <button className="modal-close" onClick={() => setIsMobileFilterOpen(false)}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* 1. Governorates + City/Neighborhood (2-column paired row) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>المحافظة</label>
                  <select value={filters.governorate} onChange={(e) => setFilters({ ...filters, governorate: e.target.value })} style={{ padding: '0.45rem 0.5rem', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}>
                    <option value="">جميع المحافظات</option>
                    <optgroup label="المحافظات المتاحة حالياً">
                      {dbGovernorates.filter(g => g.status === 'live').map(g => (
                        <option key={g.id} value={g.name}>{g.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="المحافظات المتاحة في قائمة الانتظار">
                      {dbGovernorates.filter(g => g.status !== 'live').map(g => (
                        <option key={g.id} value={g.name} style={{ color: '#94a3b8' }}>
                          {g.name} (قريباً)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>المدينة / الحي</label>
                  <input 
                    type="text" 
                    placeholder="مدينة نصر، الدقي..." 
                    value={filters.neighborhood} 
                    onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
                    style={{ padding: '0.45rem 0.5rem', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              {/* 2. Gender Horizontal Toggle Chips */}
              <div className="form-group" style={{ gap: '0.25rem', marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>النوع المسموح بالسكن</label>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[
                    { id: '', label: 'الكل' },
                    { id: 'male', label: 'طلاب' },
                    { id: 'female', label: 'طالبات' }
                  ].map(chip => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilters({ ...filters, gender: chip.id })}
                      style={{
                        flex: 1, padding: '0.4rem 0.4rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
                        border: filters.gender === chip.id ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                        background: filters.gender === chip.id ? 'var(--primary-light)' : '#ffffff',
                        color: filters.gender === chip.id ? 'var(--primary-dark)' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Advertiser Type Horizontal Toggle Chips */}
              <div className="form-group" style={{ gap: '0.25rem', marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>صفة المعلن</label>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[
                    { id: '', label: 'الكل' },
                    { id: 'owner', label: 'مالك مباشر' },
                    { id: 'broker', label: 'وسيط' }
                  ].map(chip => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilters({ ...filters, advertiser_type: chip.id })}
                      style={{
                        flex: 1, padding: '0.4rem 0.4rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
                        border: filters.advertiser_type === chip.id ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                        background: filters.advertiser_type === chip.id ? 'var(--primary-light)' : '#ffffff',
                        color: filters.advertiser_type === chip.id ? 'var(--primary-dark)' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Monthly Price Range (2 columns with +/- steppers: +100 EGP / -50 EGP) */}
              <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>نطاق السعر الشهري (ج.م)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  
                  {/* Min Price Stepper (-50 / +100) */}
                  <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: '#ffffff' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(filters.min_price) || 0;
                        const next = Math.max(0, cur - 50);
                        setFilters({ ...filters, min_price: next === 0 ? '' : String(next) });
                      }}
                      style={{ padding: '0.35rem 0.55rem', background: '#f1f5f9', border: 'none', borderLeft: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#334155' }}
                      title="-50 ج.م"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      placeholder="الأدنى" 
                      value={filters.min_price} 
                      onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} 
                      style={{ width: '100%', border: 'none', padding: '0.35rem 0.2rem', fontSize: '0.8rem', textAlign: 'center', outline: 'none', background: 'transparent' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(filters.min_price) || 0;
                        const next = cur + 100;
                        setFilters({ ...filters, min_price: String(next) });
                      }}
                      style={{ padding: '0.35rem 0.55rem', background: '#f1f5f9', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#334155' }}
                      title="+100 ج.م"
                    >
                      +
                    </button>
                  </div>

                  {/* Max Price Stepper (-50 / +100) */}
                  <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: '#ffffff' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(filters.max_price) || 0;
                        const next = Math.max(0, cur - 50);
                        setFilters({ ...filters, max_price: next === 0 ? '' : String(next) });
                      }}
                      style={{ padding: '0.35rem 0.55rem', background: '#f1f5f9', border: 'none', borderLeft: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#334155' }}
                      title="-50 ج.م"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      placeholder="الأقصى" 
                      value={filters.max_price} 
                      onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} 
                      style={{ width: '100%', border: 'none', padding: '0.35rem 0.2rem', fontSize: '0.8rem', textAlign: 'center', outline: 'none', background: 'transparent' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(filters.max_price) || 0;
                        const next = cur + 100;
                        setFilters({ ...filters, max_price: String(next) });
                      }}
                      style={{ padding: '0.35rem 0.55rem', background: '#f1f5f9', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#334155' }}
                      title="+100 ج.م"
                    >
                      +
                    </button>
                  </div>

                </div>
              </div>

              {/* 5. Total Bed Capacity Range (2 columns) */}
              <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>عدد الأسرة الكلي بالشقة</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input 
                    type="number" 
                    placeholder="الأدنى (1)" 
                    min="1"
                    value={filters.min_total_beds} 
                    onChange={(e) => setFilters({ ...filters, min_total_beds: e.target.value })} 
                    style={{ padding: '0.45rem 0.5rem', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}
                  />
                  <input 
                    type="number" 
                    placeholder="الأقصى (10)" 
                    min="1"
                    value={filters.max_total_beds} 
                    onChange={(e) => setFilters({ ...filters, max_total_beds: e.target.value })} 
                    style={{ padding: '0.45rem 0.5rem', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              {/* 6. Room Type Horizontal Chips */}
              <div className="form-group" style={{ gap: '0.25rem', marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>نوع الغرفة</label>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'single', label: 'فردية' },
                    { id: 'double', label: 'ثنائية' },
                    { id: 'triple', label: 'ثلاثية' },
                    { id: 'quadruple', label: 'رباعية' }
                  ].map(chip => {
                    const isSelected = filters.room_types.includes(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => {
                          const updated = isSelected 
                            ? filters.room_types.filter(t => t !== chip.id)
                            : [...filters.room_types, chip.id];
                          setFilters({ ...filters, room_types: updated });
                        }}
                        style={{
                          flex: '1 1 22%', padding: '0.4rem 0.3rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700,
                          border: isSelected ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                          background: isSelected ? 'var(--primary-light)' : '#ffffff',
                          color: isSelected ? 'var(--primary-dark)' : '#475569',
                          cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                        }}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7. Trailing Lease Conditions Chips */}
              <div className="form-group" style={{ gap: '0.25rem', marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>شروط ومزايا الإيجار</label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, services_inclusive: !filters.services_inclusive })}
                    style={{
                      flex: 1, padding: '0.4rem 0.4rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700,
                      border: filters.services_inclusive ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: filters.services_inclusive ? '#dcfce7' : '#ffffff',
                      color: filters.services_inclusive ? '#15803d' : '#475569',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                    }}
                  >
                    <Zap style={{ width: 13, height: 13 }} /> شامل الخدمات
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, has_insurance: !filters.has_insurance })}
                    style={{
                      flex: 1, padding: '0.4rem 0.4rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700,
                      border: filters.has_insurance ? '2px solid #d97706' : '1px solid #cbd5e1',
                      background: filters.has_insurance ? '#fef3c7' : '#ffffff',
                      color: filters.has_insurance ? '#b45309' : '#475569',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                    }}
                  >
                    <Shield style={{ width: 13, height: 13 }} /> يتطلب تأمين
                  </button>
                </div>
              </div>

              {/* 8. Max Commission + Amenities Modal Button (2-column paired row) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.45rem' }}>
                <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>أقصى عمولة (ج.م)</label>
                  <input 
                    type="number" 
                    placeholder="1000" 
                    value={filters.max_commission} 
                    onChange={(e) => setFilters({ ...filters, max_commission: e.target.value })}
                    style={{ padding: '0.45rem 0.5rem', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}
                  />
                </div>

                <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>المرافق والخدمات</label>
                  <button 
                    type="button"
                    className="btn-outline" 
                    style={{ padding: '0.45rem 0.4rem', fontSize: '0.76rem', fontWeight: 700, width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    onClick={() => setShowAmenitiesModal(true)}
                  >
                    {filters.amenities.length > 0 ? `المرافق (${filters.amenities.length})` : 'اختر المرافق'}
                  </button>
                </div>
              </div>

              {/* 9. Sort By */}
              <div className="form-group" style={{ gap: '0.2rem', marginBottom: 0 }}>
                <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>ترتيب النتائج حسب</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ padding: '0.45rem 0.5rem', background: '#ffffff', border: '1.5px solid #94a3b8', borderRadius: 'var(--r-sm)', fontWeight: 700, fontSize: '0.8rem' }}
                >
                  <option value="newest">الأحدث نُشراً</option>
                  <option value="oldest">الأقدم نُشراً</option>
                  <option value="price_asc">السعر: من الأقل للأعلى</option>
                  <option value="price_desc">السعر: من الأعلى للأقل</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', background: '#f8fafc', display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn-outline" 
                style={{ flex: 1, padding: '0.65rem' }}
                onClick={() => {
                  setFilters({ governorate: '', city: '', neighborhood: '', gender: '', min_price: '', max_price: '', room_types: [], amenities: [], advertiser_type: '', max_commission: '', services_inclusive: false, has_insurance: false, min_total_beds: '', max_total_beds: '' });
                }}
              >
                مسح الكل
              </button>
              <button className="btn-primary" style={{ flex: 2, padding: '0.65rem', fontWeight: 800 }} onClick={() => setIsMobileFilterOpen(false)}>
                عرض النتائج ({sortedListings.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONTACT & FEEDBACK CHANNELS MODAL POPUP --- */}
      {isContactModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '520px', borderRadius: '20px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                <MessageSquare style={{ width: 20, height: 20, color: 'var(--primary)' }} />
                قنوات التواصل والدعم الفني
              </h3>
              <button className="modal-close" onClick={() => setIsContactModalOpen(false)}>×</button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              
              {/* Channel 1: WhatsApp (Questions / Student Enquiries) */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: '#166534' }}>
                    <MessageSquare style={{ width: 18, height: 18, color: '#16a34a' }} />
                    <span>أسئلة واستفسارات الطلاب (أسئلة)</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.55rem', borderRadius: '999px', fontWeight: 700 }}>
                    فوري عبر الواتساب
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
                  لجميع الأسئلة السريعة والاستفسارات اليومية للطلاب حول السكن المتاح.
                </p>
                <a
                  href="https://wa.me/201062400034?text=%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%B9%D9%86%D8%AF%D9%8A%20%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%AE%D8%A7%D8%B5%20%D8%A8%D9%85%D9%86%D8%B5%D8%A9%20%D8%B3%D9%83%D9%86"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: '0.25rem', padding: '0.5rem 1rem', background: '#16a34a', color: '#ffffff',
                    borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: 'fit-content'
                  }}
                >
                  <MessageSquare style={{ width: 15, height: 15 }} />
                  مراسلة الدعم عبر الواتساب (01062400034)
                </a>
              </div>

              {/* Channel 2: Support Email (Suggestions & Feedback) */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: '#1e40af' }}>
                    <Mail style={{ width: 18, height: 18, color: '#2563eb' }} />
                    <span>اقتراحات وملاحظات الفيدباك (اقتراحات)</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '0.15rem 0.55rem', borderRadius: '999px', fontWeight: 700 }}>
                    إيميل الدعم
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
                  لتقديم الفيدباك والاقتراحات أو ملاحظات تحسين تجربة المنصة.
                </p>
                <a
                  href="mailto:support@sakan-egy.com"
                  style={{
                    marginTop: '0.25rem', padding: '0.5rem 1rem', background: '#2563eb', color: '#ffffff',
                    borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: 'fit-content'
                  }}
                >
                  <Mail style={{ width: 15, height: 15 }} />
                  support@sakan-egy.com
                </a>
              </div>

              {/* Channel 3: Business Email (Business & Partnerships) */}
              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: '#6b21a8' }}>
                    <Briefcase style={{ width: 18, height: 18, color: '#9333ea' }} />
                    <span>استفسارات بزنس وشراكات (بزنس)</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#f3e8ff', color: '#7e22ce', padding: '0.15rem 0.55rem', borderRadius: '999px', fontWeight: 700 }}>
                    إيميل البيزنس
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
                  لطلبات التعاون وشراكات الأعمال والتوسع السكني الاستثماري.
                </p>
                <a
                  href="mailto:business@sakan-egy.com"
                  style={{
                    marginTop: '0.25rem', padding: '0.5rem 1rem', background: '#9333ea', color: '#ffffff',
                    borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: 'fit-content'
                  }}
                >
                  <Briefcase style={{ width: 15, height: 15 }} />
                  business@sakan-egy.com
                </a>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
