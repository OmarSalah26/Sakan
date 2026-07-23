import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default marker icon paths broken by Vite's asset pipeline
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// ---------------------------------------------------------------------------
// formatAddress — builds a display string from structured address fields
// Falls back to raw address string for old listings
// ---------------------------------------------------------------------------
function formatAddress(listing) {
  const { street, building_number, apartment_number, floor, address } = listing;
  if (!building_number && !street) return address || '';
  const parts = [];
  if (building_number) parts.push(`مبنى ${building_number}`);
  if (apartment_number) parts.push(`شقة ${apartment_number}`);
  if (floor) parts.push(`الدور ${floor}`);
  if (street) parts.push(`شارع ${street}`);
  return parts.join('، ');
}

// ---------------------------------------------------------------------------
// MapPickerModal — full-screen modal with Leaflet, draggable marker,
// pre-geocoded from address fields. Confirm saves lat/lng.
// ---------------------------------------------------------------------------
function MapPickerModal({ addressQuery, cityFallback, initialLat, initialLng, onConfirm, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [pending, setPending] = useState({ lat: initialLat, lng: initialLng });
  const [geocoding, setGeocoding] = useState(false);

  // Geocode the address query on mount to seed the map position
  useEffect(() => {
    const init = async () => {
      if (!containerRef.current) return;

      // Default to Egypt center; will be updated after geocoding
      const map = L.map(containerRef.current).setView([26.8206, 30.8025], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      const placeMarker = (lat, lng) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', (e) => {
            const { lat: la, lng: ln } = e.target.getLatLng();
            setPending({ lat: la, lng: ln });
          });
        }
        map.setView([lat, lng], 16);
        setPending({ lat, lng });
      };

      // If we already have coords (re-opening), use them
      if (initialLat && initialLng) {
        placeMarker(initialLat, initialLng);
        return;
      }

      // Geocode the address
      if (addressQuery.trim()) {
        setGeocoding(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&limit=1&countrycodes=eg`,
            { headers: { 'Accept-Language': 'ar' } }
          );
          const data = await res.json();
          if (data.length > 0) {
            placeMarker(parseFloat(data[0].lat), parseFloat(data[0].lon));
            setGeocoding(false);
            return;
          }
        } catch {}
        setGeocoding(false);
      }

      // Fallback: geocode the city name only
      if (cityFallback.trim()) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityFallback)}&limit=1&countrycodes=eg`,
            { headers: { 'Accept-Language': 'ar' } }
          );
          const data = await res.json();
          if (data.length > 0) {
            map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 13);
          }
        } catch {}
      }

      // Allow manual click placement if geocoding failed
      map.on('click', (e) => placeMarker(e.latlng.lat, e.latlng.lng));
    };

    init();
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; } };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: '680px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontWeight: 700, margin: 0 }}>📍 تحديد موقع العقار</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              {geocoding ? 'جاري تحديد الموقع التقريبي من العنوان...' : 'اسحب الدبوس الأحمر لضبط الموقع بدقة على مدخل العقار.'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Map */}
        <div ref={containerRef} style={{ width: '100%', height: '420px' }} />

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <span style={{ fontSize: '0.8rem', color: pending.lat ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
            {pending.lat
              ? `✅ الموقع: (${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)})`
              : 'اضغط على الخريطة لوضع الدبوس'}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={onClose}>إلغاء</button>
            <button
              className="btn-primary"
              disabled={!pending.lat}
              onClick={() => onConfirm(pending.lat, pending.lng)}
            >
              تأكيد الموقع ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const API_BASE = '/api';

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "البحر الأحمر", "المنوفية", 
  "الفيوم", "قنا", "الأقصر", "أسوان", "أسيوط", "المنيا", "بني سويف", 
  "الشرقية", "القليوبية", "الغربية", "البحيرة", "دمياط", "كفر الشيخ", 
  "بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء", "جنوب سيناء", 
  "الوادي الجديد", "مطروح"
];

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

export default function App() {
  const [tab, setTab] = useState('browse'); // 'browse' | 'dashboard' | 'admin'
  const [listings, setListings] = useState([]);
  const [toast, setToast] = useState('');
  
  // Auth state
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('register'); // 'register' | 'login'
  const [authStep, setAuthStep] = useState('phone'); // 'phone' | 'otp' | 'details'
  const [authForm, setAuthForm] = useState({
    phone: '',
    otp: '',
    name: '',
    account_type: 'student', // 'student' | 'broker' | 'admin'
    governorates: [],
    profile_photo_url: ''
  });
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
    has_insurance: false
  });

  // Create listing wizard state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [termsChecked, setTermsChecked] = useState(false);
  const [customAmenity, setCustomAmenity] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    governorate: '',
    city: '',
    neighborhood: '',
    address: '',
    street: '',
    building_number: '',
    apartment_number: '',
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
    tier: 'regular'
  });

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
  const [adminTab, setAdminTab] = useState('complaints'); // 'complaints' | 'users' | 'listings'

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

      const res = await fetch(`${API_BASE}/listings?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadListings();
  }, [filters]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // --- Auth logic ---
  const handleStartAuth = (mode, overrideType = null, callback = null) => {
    setAuthMode(mode);
    setAuthForm({
      phone: '',
      otp: '',
      name: '',
      account_type: overrideType || 'student',
      governorates: [],
      profile_photo_url: ''
    });
    setAuthStep('phone');
    setPendingAction(() => callback);
    setIsAuthOpen(true);
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = authMode === 'register' ? 'register' : 'login-otp';
      const payload = authMode === 'register' ? {
        phone: authForm.phone,
        name: "مستخدم جديد",
        account_type: authForm.account_type,
        governorates: authForm.governorates,
        profile_photo_url: authForm.profile_photo_url
      } : {
        phone: authForm.phone
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
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: authForm.phone,
          otp_code: authForm.otp
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
          showToast(`تم تسجيل الدخول بنجاح! مرحباً بك، ${data.name}`);
          if (pendingAction) {
            pendingAction(finalUser);
            setPendingAction(null);
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
          account_type: user.account_type,
          governorates: authForm.governorates,
          profile_photo_url: authForm.profile_photo_url
        })
      });
      const data = await res.json();
      if (res.ok) {
        const updatedUser = {
          ...user,
          name: authForm.name,
          governorates: authForm.governorates,
          profile_photo_url: authForm.profile_photo_url
        };
        setUser(updatedUser);
        setIsAuthOpen(false);
        showToast(`تم اكتمال إعداد حسابك بنجاح!`);
        if (pendingAction) {
          pendingAction(updatedUser);
          setPendingAction(null);
        }
      }
    } catch (err) {
      showToast("حدث خطأ أثناء حفظ البيانات");
    }
  };

  // --- Listing Details modal ---
  const openListingDetail = async (listingId) => {
    try {
      const res = await fetch(`${API_BASE}/listings/${listingId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedListingDetail(data);
        setCarouselIndex(0);
        setShowRatingForm(false);
        setShowComplaintForm(false);
        setRatingInput({ star_count: 5, review_text: '', photo_urls: [] });
      } else {
        showToast("فشل تحميل تفاصيل العقار");
      }
    } catch (err) {
      showToast("خطأ في الاتصال بالخادم");
    }
  };

  // --- Create Listing wizard flow ---
  const handleOpenCreateFlow = () => {
    if (!user) {
      handleStartAuth('register', 'broker', () => {
        setIsCreateOpen(true);
        setCreateStep(1);
        setTermsChecked(false);
      });
      return;
    }
    if (user.account_type === 'student') {
      showToast("عذراً! حسابات المستخدمين العاديين لا يمكنها نشر عقارات. يرجى تسجيل الدخول كـ سمسار.");
      return;
    }
    const initialGov = user.governorates?.length ? user.governorates[0] : "القاهرة";
      
    setCreateForm({
      title: '',
      governorate: initialGov,
      city: '',
      neighborhood: '',
      address: '',
      street: '',
      building_number: '',
      apartment_number: '',
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
      tier: 'regular'
    });
    setShowMapPicker(false);
    setIsCreateOpen(true);
    setCreateStep(1);
    setTermsChecked(false);
  };

  const handleStep2Next = async () => {
    if (createForm.latitude && createForm.longitude) {
      setCreateStep(3);
      return;
    }

    const query = [createForm.street, createForm.neighborhood, createForm.city].filter(Boolean).join(' ');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=eg`,
        { headers: { 'Accept-Language': 'ar' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setCreateForm(prev => ({
          ...prev,
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        }));
      } else {
        const fallbackRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(createForm.city)}&limit=1&countrycodes=eg`,
          { headers: { 'Accept-Language': 'ar' } }
        );
        const fallbackData = await fallbackRes.json();
        if (fallbackData && fallbackData.length > 0) {
          setCreateForm(prev => ({
            ...prev,
            latitude: parseFloat(fallbackData[0].lat),
            longitude: parseFloat(fallbackData[0].lon)
          }));
        }
      }
    } catch (err) {}
    setCreateStep(3);
  };

  const handleCreateSubmit = async () => {
    try {
      let payload = { ...createForm, advertiser_id: user.id };
      if (!payload.latitude || !payload.longitude) {
        const query = [createForm.street, createForm.neighborhood, createForm.city].filter(Boolean).join(' ');
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=eg`,
            { headers: { 'Accept-Language': 'ar' } }
          );
          const data = await res.json();
          if (data && data.length > 0) {
            payload.latitude = parseFloat(data[0].lat);
            payload.longitude = parseFloat(data[0].lon);
          }
        } catch {}
      }

      const res = await fetch(`${API_BASE}/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast("تم نشر العقار بنجاح!");
        setIsCreateOpen(false);
        loadListings();
      } else {
        const err = await res.json();
        showToast(err.detail || "فشل نشر العقار");
      }
    } catch (err) {
      showToast("خطأ في الاتصال بالخادم");
    }
  };

  const addRoomConfig = () => {
    setCreateForm(prev => ({
      ...prev,
      room_configurations: [...prev.room_configurations, { room_type: 'double', price_per_person: 800, commission: 400, count: 1, insurance_price: '', services_inclusive: false }]
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
      updated[index] = { ...updated[index], [field]: val };
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
        showToast("تم إعادة نشر الإعلان بنجاح");
        loadListings();
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
    if (!user || user.account_type !== 'admin') return;
    try {
      const resC = await fetch(`${API_BASE}/admin/complaints?x_user_id=${user.id}`);
      if (resC.ok) setAdminComplaints(await resC.json());

      const resU = await fetch(`${API_BASE}/admin/users?x_user_id=${user.id}`);
      if (resU.ok) setAdminUsers(await resU.json());

      const resL = await fetch(`${API_BASE}/admin/listings?x_user_id=${user.id}`);
      if (resL.ok) setAdminListings(await resL.json());
    } catch (err) {
      console.error(err);
    }
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

  const getPresetOptions = (stars) => {
    if (stars === 5) return ["نظيف جداً", "الأسعار مناسبة", "الجيران محترمون", "موقع ممتاز", "المرافق كما هو معلن"];
    if (stars >= 3) return ["نظافة مقبولة", "الموقع كويس", "بعض المرافق ناقصة", "السعر مناسب نسبياً"];
    return ["غير نظيف", "المرافق مش زي ما اتعلن", "الموقع بعيد", "السعر مش مناسب", "مشاكل في الصيانة"];
  };

  // Role verification tags
  const isBroker = user && (user.account_type === 'broker' || user.account_type === 'owner');
  const isAdmin = user && user.account_type === 'admin';
  const isNormalUser = user && (user.account_type === 'student' || user.account_type === 'normal_user');

  return (
    <div>
      {/* Toast Alert Banner */}
      {toast && (
        <div className="alert-toast">
          <span>🔔</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Navigation Header */}
      <header className="navbar">
        <a href="#" className="logo" onClick={() => setTab('browse')}>
          سكن <span>Sakan</span>
        </a>
        <div className="nav-links">
          <button 
            className={tab === 'browse' ? 'active-tab' : 'inactive-tab'} 
            onClick={() => setTab('browse')}
          >
            تصفح العقارات
          </button>
          <button 
            className={tab === 'guide' ? 'active-tab' : 'inactive-tab'} 
            onClick={() => setTab('guide')}
          >
            دليل الطالب 📘
          </button>

          {/* Create listing button accessible for Brokers, Admins, or guests */}
          {(!user || isBroker || isAdmin) && (
            <button 
              className="btn-primary" 
              onClick={handleOpenCreateFlow}
              style={{ fontWeight: 700 }}
            >
              أضف إعلانك ➕
            </button>
          )}

          {/* Show dashboard to logged-in Brokers and Admins */}
          {(isBroker || isAdmin) && (
            <button 
              className={tab === 'dashboard' ? 'active-tab' : 'inactive-tab'} 
              onClick={() => setTab('dashboard')}
            >
              لوحة التحكم
            </button>
          )}

          {/* Show admin panel ONLY to logged-in Admins */}
          {isAdmin && (
            <button 
              className={tab === 'admin' ? 'active-tab' : 'inactive-tab'} 
              onClick={() => setTab('admin')}
            >
              لوحة الإشراف
            </button>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginRight: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{user.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  {isAdmin ? 'مشرف المنصة' : isBroker ? 'سمسار عقاري' : 'مستخدم عادي'}
                </div>
              </div>
              <button className="btn-secondary" onClick={() => { setUser(null); showToast("تم تسجيل الخروج"); setTab('browse'); }}>خروج</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => handleStartAuth('login')}>تسجيل الدخول</button>
              <button className="btn-outline" onClick={() => handleStartAuth('register')}>إنشاء حساب</button>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        
        {/* TAB 1: BROWSE LISTINGS FEED */}
        {tab === 'browse' && (
          <div>
            <div className="hero-section">
              <h1 className="hero-title">ابحث عن <span>سكنك الطلابي</span> المثالي</h1>
              <p className="hero-subtitle">أول منصة متكاملة في مصر لربط الطلاب المغتربين بأفضل الوحدات السكنية المتاحة في جميع المحافظات الجامعية.</p>
            </div>

            <div className="main-layout">
              {/* Sidebar Filters */}
              <aside className="filter-sidebar">
                <h3>
                  <span>تصفية النتائج</span>
                  <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setFilters({
                    governorate: '', city: '', neighborhood: '', gender: '', min_price: '', max_price: '', room_types: [], amenities: [], advertiser_type: ''
                  })}>مسح الكل</button>
                </h3>
                
                <div className="form-group">
                  <label>المحافظة</label>
                  <select value={filters.governorate} onChange={(e) => setFilters({ ...filters, governorate: e.target.value })}>
                    <option value="">جميع المحافظات</option>
                    {GOVERNORATES.map(gov => (
                      <option key={gov} value={gov}>{gov}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>المدينة / الحي</label>
                  <input 
                    type="text" 
                    placeholder="مثال: مدينة نصر، الدقي..." 
                    value={filters.neighborhood} 
                    onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>النوع (سكن طلاب / طالبات)</label>
                  <select value={filters.gender} onChange={(e) => setFilters({ ...filters, gender: e.target.value })}>
                    <option value="">الكل</option>
                    <option value="male">طلاب (شباب)</option>
                    <option value="female">طالبات (بنات)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>نطاق السعر الشهري (جنيه مصري)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      placeholder="الأدنى" 
                      value={filters.min_price} 
                      onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} 
                    />
                    <input 
                      type="number" 
                      placeholder="الأقصى" 
                      value={filters.max_price} 
                      onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>نوع الغرفة</label>
                  {['single', 'double', 'triple', 'quadruple'].map(type => {
                    const labelText = type === 'single' ? 'فردية (Single)' : type === 'double' ? 'ثنائية (Double)' : type === 'triple' ? 'ثلاثية (Triple)' : 'رباعية (Quadruple)';
                    const isChecked = filters.room_types.includes(type);
                    return (
                      <label key={type} className="checkbox-label" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            const updated = isChecked 
                              ? filters.room_types.filter(t => t !== type)
                              : [...filters.room_types, type];
                            setFilters({ ...filters, room_types: updated });
                          }}
                        />
                        {labelText}
                      </label>
                    );
                  })}
                </div>

                <div className="form-group">
                  <label>الحد الأقصى للعمولة (جنيه)</label>
                  <input 
                    type="number" 
                    placeholder="مثال: 1000" 
                    value={filters.max_commission} 
                    onChange={(e) => setFilters({ ...filters, max_commission: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label" style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={filters.services_inclusive}
                      onChange={(e) => setFilters({ ...filters, services_inclusive: e.target.checked })}
                    />
                    شامل الخدمات (الكهرباء، المياه، إلخ)
                  </label>
                  <label className="checkbox-label" style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      checked={filters.has_insurance}
                      onChange={(e) => setFilters({ ...filters, has_insurance: e.target.checked })}
                    />
                    يتطلب دفع تأمين
                  </label>
                </div>

                <div className="form-group">
                  <label>المعلن</label>
                  <select value={filters.advertiser_type} onChange={(e) => setFilters({ ...filters, advertiser_type: e.target.value })}>
                    <option value="">الكل</option>
                    <option value="owner">مالك مباشر</option>
                    <option value="broker">سمسار عقاري</option>
                  </select>
                </div>

                <div className="form-group" style={{ maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <label>الخدمات والمرافق المتوفرة</label>
                  {INDOOR_AMENITIES.slice(0, 8).map(amenity => {
                    const isChecked = filters.amenities.includes(amenity.name);
                    return (
                      <label key={amenity.name} className="checkbox-label" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const updated = isChecked 
                              ? filters.amenities.filter(a => a !== amenity.name)
                              : [...filters.amenities, amenity.name];
                            setFilters({ ...filters, amenities: updated });
                          }}
                        />
                        {amenity.name}
                      </label>
                    );
                  })}
                </div>
              </aside>

              {/* Listings feed */}
              <section style={{ flexGrow: 1 }}>
                <div className="section-header">
                  <span className="section-count">العقارات المتاحة: {listings.length} إعلان</span>
                </div>

                {listings.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3 className="empty-title">لم نجد أي نتائج تطابق بحثك</h3>
                    <p className="empty-desc">جرب مسح بعض الفلاتر أو تعديل نطاق البحث الخاص بك.</p>
                  </div>
                ) : (
                  <div className="listings-grid">
                    {listings.map((item) => {
                      const coverImage = item.photo_urls && item.photo_urls.length > 0
                        ? item.photo_urls[0]
                        : "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80";

                      let totalBeds = 0;
                      let breakdown = [];
                      if (item.room_configurations && item.room_configurations.length > 0) {
                        item.room_configurations.forEach(c => {
                          let bedsPerRoom = 1;
                          let name = 'فردية';
                          let icon = '🛏️';
                          if (c.room_type === 'double') { bedsPerRoom = 2; name = 'ثنائية'; icon = '🛏️🛏️'; }
                          else if (c.room_type === 'triple') { bedsPerRoom = 3; name = 'ثلاثية'; icon = '🛏️🛏️🛏️'; }
                          else if (c.room_type === 'quadruple') { bedsPerRoom = 4; name = 'رباعية'; icon = '🛏️🛏️🛏️🛏️'; }
                          else if (c.room_type === 'triple+') { bedsPerRoom = 4; name = 'مشتركة ٤+'; icon = '🛏️🛏️🛏️🛏️'; } // legacy
                          
                          const count = c.count || 1;
                          totalBeds += (bedsPerRoom * count);
                          breakdown.push(`${count} غرف ${name}`);
                        });
                      } else {
                        totalBeds = item.available_beds;
                      }

                      return (
                        <article 
                          key={item.id} 
                          className="listing-card"
                          onClick={() => openListingDetail(item.id)}
                        >
                          <div className="card-img-wrapper">
                            <img className="card-img" src={coverImage} alt={item.title} />
                            
                            <span className={`badge-gender ${item.gender === 'male' ? 'gender-male' : 'gender-female'}`}>
                              {item.gender === 'male' ? '♂ طلاب' : '♀ طالبات'}
                            </span>
                            
                            {item.tier === 'premium' && (
                              <span className="badge-premium">⭐ إعلان مميز</span>
                            )}
                          </div>

                          <div className="card-content">
                            <div className="card-location">📍 {item.governorate}، {item.city}</div>
                            <h2 className="card-title">{item.title}</h2>
                            <div className="card-room-types" style={{ fontSize: '0.85rem' }}>{breakdown.join(' + ')}</div>
                            <div className="card-beds" style={{ fontWeight: 600 }}>إجمالي السعة: {totalBeds} سرير</div>
                            
                            <div className="card-price-list">
                              {item.room_configurations && item.room_configurations.length > 0 ? (
                                item.room_configurations.map((config, idx) => {
                                  let icon = '🛏️';
                                  if (config.room_type === 'double') icon = '🛏️🛏️';
                                  else if (config.room_type === 'triple') icon = '🛏️🛏️🛏️';
                                  else if (config.room_type === 'quadruple' || config.room_type === 'triple+') icon = '🛏️🛏️🛏️🛏️';
                                  
                                  return (
                                    <div key={idx} className="price-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '0.5rem', background: 'var(--bg-muted)', borderRadius: 'var(--r-sm)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <span className="room-lbl">{icon} ({config.count || 1})</span>
                                        <span className="room-val">{config.price_per_person} ج.م/فرد</span>
                                      </div>
                                      {config.commission && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                                          عمولة: {config.commission} ج.م
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="price-item">
                                  <span className="room-lbl">سعر السرير:</span>
                                  <span className="room-val">{item.price_per_person} ج.م</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="card-footer">
                            <span className="advertiser-label">👤 {item.advertiser_id ? 'معلن مسجل' : 'معلن'}</span>
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
                      <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>📍 {item.governorate}، {item.city}، {item.neighborhood}</p>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        <span>الحالة: <strong style={{ color: item.status === 'active' ? 'var(--primary)' : 'red' }}>
                          {item.status === 'active' ? 'نشط' : item.status === 'inactive' ? 'غير نشط' : 'محظور'}
                        </strong></span>
                        <span>الأسرة المتاحة: <strong>{item.available_beds}</strong></span>
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
                        
                        <button 
                          className="btn-outline" 
                          onClick={() => handleToggleStatus(item.id)}
                          style={{ borderColor: item.status === 'active' ? '#f87171' : '#4ade80', color: item.status === 'active' ? '#ef4444' : '#16a34a' }}
                        >
                          {item.status === 'active' ? 'إيقاف الإعلان ⏸️' : 'تفعيل الإعلان ▶️'}
                        </button>

                        <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: '#0f766e', fontSize: '0.75rem', fontWeight: 600, width: '100%', marginTop: '0.5rem' }}>
                          💡 تذكير: لا تنسَ طلب التقييم من الطلاب عند إتمام التعاقد لتحسين ترتيب إعلاناتك!
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

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <button className={adminTab === 'complaints' ? 'active-tab' : 'btn-secondary'} onClick={() => setAdminTab('complaints')}>طابور الشكاوى ({adminComplaints.length})</button>
              <button className={adminTab === 'users' ? 'active-tab' : 'btn-secondary'} onClick={() => setAdminTab('users')}>إدارة المعلنين ({adminUsers.length})</button>
              <button className={adminTab === 'listings' ? 'active-tab' : 'btn-secondary'} onClick={() => setAdminTab('listings')}>إدارة الوحدات ({adminListings.length})</button>
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
                              <button className="btn-warning" style={{ fontSize: '0.85rem' }} onClick={() => handleAdminAction(c.id, 'warn')}>توجيه تحذير ⚠️</button>
                              <button className="btn-danger" style={{ fontSize: '0.85rem' }} onClick={() => handleAdminAction(c.id, 'ban')}>حظر معلن 🚫</button>
                              <button className="btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => handleAdminAction(c.id, 'dismiss')}>حفظ الشكوى 🗑️</button>
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
                <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid var(--border-color)' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>
                        <th style={{ padding: '0.75rem' }}>الاسم</th>
                        <th style={{ padding: '0.75rem' }}>رقم الهاتف</th>
                        <th style={{ padding: '0.75rem' }}>النوع</th>
                        <th style={{ padding: '0.75rem' }}>عدد المخالفات</th>
                        <th style={{ padding: '0.75rem' }}>حالة الحظر</th>
                        <th style={{ padding: '0.75rem' }}>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem' }}>{u.name}</td>
                          <td style={{ padding: '0.75rem' }}>{u.phone}</td>
                          <td style={{ padding: '0.75rem' }}>{u.account_type === 'broker' ? 'سمسار' : u.account_type === 'owner' ? 'مالك' : u.account_type === 'admin' ? 'مسؤول' : 'طالب'}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold', color: u.offense_count > 0 ? 'red' : 'inherit' }}>{u.offense_count}</td>
                          <td style={{ padding: '0.75rem', color: u.is_banned ? 'red' : 'green', fontWeight: 'bold' }}>{u.is_banned ? 'محظور' : 'نشط'}</td>
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
                  {adminListings.map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'white', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <strong>{l.title}</strong>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>📍 {l.governorate}، {l.city} | حالة الإعلان: {l.status}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-secondary" style={{ fontSize: '0.8.rem' }} onClick={() => openListingDetail(l.id)}>عرض</button>
                        {l.status === 'active' && (
                          <button className="btn-danger" style={{ fontSize: '0.8rem' }} onClick={() => handleListingDeactivate(l.id)}>إلغاء تفعيل 🛑</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STUDENT GUIDE */}
        {tab === 'guide' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem', border: '1px solid var(--border-color)' }}>
            <h2 className="details-title" style={{ fontSize: '1.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary-dark)' }}>
              دليل الطالب للسكن الجامعي 📘
            </h2>
            
            <div style={{ display: 'grid', gap: '1.5rem', lineHeight: '1.8' }}>
              <section>
                <h3 style={{ color: 'var(--primary)' }}>1️⃣ المصروفات المتوقعة وتكاليف التعاقد</h3>
                <p>عند التعاقد على سكن، ستواجه بعض المصروفات الأساسية التي يجب أن تكون مستعداً لها:</p>
                <ul style={{ paddingRight: '1.5rem', marginTop: '0.5rem' }}>
                  <li><strong>الإيجار الشهري:</strong> يُدفع مقدماً كل شهر.</li>
                  <li><strong>التأمين:</strong> مبلغ يُدفع لمرة واحدة عند التعاقد لضمان جدية الحجز وسلامة الممتلكات، ويُسترد عند انتهاء العقد إذا لم يكن هناك تلفيات (تأكد من إثباته في العقد).</li>
                  <li><strong>عمولة السمسار:</strong> تُدفع لمرة واحدة عند التعاقد إذا كان المعلن سمساراً وليس مالكاً.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)' }}>2️⃣ الخدمات المشمولة وغير المشمولة</h3>
                <p>بعض الإعلانات تكون شاملة الخدمات (مثل الكهرباء، المياه، الغاز، الإنترنت، والغاز)، والبعض الآخر لا. دائماً قم بالتأكد من المالك قبل التوقيع عما إذا كان السعر المعلن شاملاً لهذه الخدمات أم سيتطلب دفع فواتير شهرية منفصلة لتجنب أي مفاجآت.</p>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)' }}>3️⃣ معايير العمولات العادلة (للوسطاء)</h3>
                <p>في منصة سكن، نلزم الوسطاء بتحديد قيمة العمولة بوضوح لتجنب الاستغلال. المعايير المتعارف عليها:</p>
                <ul style={{ paddingRight: '1.5rem', marginTop: '0.5rem' }}>
                  <li>🟢 <strong>العمولة العادلة:</strong> تعادل نصف شهر إيجار (تُدفع مرة واحدة).</li>
                  <li>🟡 <strong>العمولة المرتفعة (غير معتادة):</strong> تعادل شهر إيجار كامل.</li>
                  <li>🔴 <strong>الاستغلال (يُرجى الإبلاغ):</strong> طلب عمولة تعادل شهرين إيجار أو أكثر.</li>
                </ul>
                <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: '#c2410c', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  📢 تنبيه: تلزم "سكن" السماسرة بالإفصاح عن عمولاتهم في الإعلان. أي محاولة لطلب عمولة أعلى من المذكورة بالإعلان يجب الإبلاغ عنها فوراً لحظر الحساب.
                </div>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)' }}>4️⃣ آداب السكن الجامعي</h3>
                <p>تذكر أنك تتشارك مكاناً مع زملاء آخرين. التزم بالقواعد التالية لتجربة سكن مريحة للجميع:</p>
                <ul style={{ paddingRight: '1.5rem', marginTop: '0.5rem' }}>
                  <li>حافظ على نظافة المساحات المشتركة (المطبخ، الحمام، والصالة).</li>
                  <li>احترم أوقات الراحة والهدوء، خاصة في فترات الامتحانات والليل.</li>
                  <li>حافظ على سلامة الأجهزة الكهربائية والمرافق لتجنب خصم التأمين.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: 'var(--primary)' }}>5️⃣ القواعد الذهبية قبل دفع أي مبالغ مالية ⚠️</h3>
                <ul style={{ paddingRight: '1.5rem', marginTop: '0.5rem' }}>
                  <li><strong>لا تقم بتحويل أي مبالغ مالية (مثل عربون) قبل معاينة الشقة بنفسك ومقابلة المالك/السمسار شخصياً.</strong></li>
                  <li>تأكد من تطابق الشقة مع الصور والوصف المذكور في الإعلان (وجود تكييف، ثلاجة، غسالة تعمل، إلخ).</li>
                  <li>استخدم نظام التقييمات وقراءة شكاوى الطلاب الآخرين لتجنب التجارب السيئة.</li>
                  <li>اقرأ <a href="#" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>شروط الخدمة</a> لمعرفة حقوقك وواجباتك.</li>
                </ul>
              </section>
            </div>
          </div>
        )}

      </main>

      {/* --- AUTHENTICATION MODAL (Arabic / Distinct Login vs Register) --- */}
      {isAuthOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>
                {authMode === 'register' 
                  ? (authStep === 'phone' ? 'إنشاء حساب جديد' : authStep === 'otp' ? 'رمز تحقق الحساب' : 'بيانات الحساب الإضافية')
                  : (authStep === 'phone' ? 'تسجيل الدخول بالهاتف' : 'تأكيد الرمز والدخول')
                }
              </h3>
              <button className="modal-close" onClick={() => setIsAuthOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              
              {/* Step 1: Input Phone */}
              {authStep === 'phone' && (
                <form onSubmit={handlePhoneSubmit}>
                  {authMode === 'register' && (
                    <div className="form-group">
                      <label>نوع حسابك</label>
                      <select value={authForm.account_type} onChange={(e) => setAuthForm({ ...authForm, account_type: e.target.value })}>
                        <option value="student">طالب / مستخدم عادي</option>
                        <option value="broker">سمسار عقارات طلابية</option>
                        <option value="admin">مسؤول المنصة (Admin)</option>
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
                    {authMode === 'register' ? 'إرسال كود تسجيل الحساب 💬' : 'إرسال كود تسجيل الدخول 🔑'}
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
                    {authMode === 'register' ? 'تأكيد الكود وتفعيل الحساب 🔑' : 'تحقق ودخول الحساب 🚀'}
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
                          : <span style={{ fontSize: '1.75rem' }}>📸</span>}
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
                        <small style={{ color: 'var(--text-light)', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>JPG أو PNG أو WEBP — حد أقصى 10 ميجابايت</small>
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

                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={user?.account_type === 'broker' && authForm.governorates.length === 0}>حفظ واكتمال التسجيل 💾</button>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- CREATE LISTING WIZARD MODAL (Arabic / 7 Steps) --- */}
      {isCreateOpen && (isBroker || isAdmin) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>إضافة إعلان سكن طلابي جديد ({createStep} من 7)</h3>
              <button className="modal-close" onClick={() => setIsCreateOpen(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="wizard-progress">
                <div className="progress-bar-fill" style={{ width: `${(createStep - 1) * 16.66}%` }} />
                {[1, 2, 3, 4, 5, 6, 7].map(num => (
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
                    <p>1️⃣ الإقرار بصحة وتحديث جميع الصور والمواصفات المدرجة للوحدة السكنية وأنها تمثل الواقع بدقة.</p>
                    <p>2️⃣ عدم تغيير الأسعار أو العمولات المدونة في هذا الإعلان عند تعاقد الطلاب على أرض الواقع.</p>
                    <p>3️⃣ المخالفة الأولى المثبتة تعرض حسابك لتحذير رسمي، والمخالفة الثانية حظر دائم لرقم الهاتف من المنصة.</p>
                  </div>
                  <label className="checkbox-label" style={{ fontWeight: 700 }}>
                    <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} />
                    أوافق وأتعهد بالالتزام بشروط نشر العقار المذكورة أعلاه.
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button className="btn-primary" disabled={!termsChecked} onClick={() => setCreateStep(2)}>المتابعة للخطوة التالية ◀️</button>
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
                        {user.governorates?.length > 0 ? (
                          user.governorates.map(gov => (
                            <option key={gov} value={gov}>{gov}</option>
                          ))
                        ) : (
                          GOVERNORATES.map(gov => (
                            <option key={gov} value={gov}>{gov}</option>
                          ))
                        )}
                      </select>
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
                    <label>الحي / المنطقة</label>
                    <input 
                      type="text" 
                      placeholder="اسم الحي بالتفصيل"
                      value={createForm.neighborhood} 
                      onChange={(e) => setCreateForm({ ...createForm, neighborhood: e.target.value })} 
                      required 
                    />
                  </div>

                  {/* Structured address fields */}
                  <div className="grid-cols-2">
                    <div className="form-group">
                      <label>الشارع <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        placeholder="مثال: شارع التحرير"
                        value={createForm.street}
                        onChange={(e) => setCreateForm({ ...createForm, street: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>رقم المبنى <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        placeholder="مثال: 12"
                        value={createForm.building_number}
                        onChange={(e) => setCreateForm({ ...createForm, building_number: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid-cols-2">
                    <div className="form-group">
                      <label>رقم الشقة <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(اختياري)</span></label>
                      <input
                        type="text"
                        placeholder="مثال: 3"
                        value={createForm.apartment_number}
                        onChange={(e) => setCreateForm({ ...createForm, apartment_number: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>الدور <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(اختياري)</span></label>
                      <input
                        type="text"
                        placeholder="مثال: 2"
                        value={createForm.floor}
                        onChange={(e) => setCreateForm({ ...createForm, floor: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Map picker trigger */}
                  <div className="form-group">
                    <label>موقع العقار على الخريطة <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(اختياري)</span></label>
                    {createForm.latitude && createForm.longitude ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>✅ تم تحديد الموقع بنجاح</span>
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
                          📍 تحديد موقع العقار على الخريطة (اختياري)
                        </button>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>في حال عدم التحديد، سيتم استنباط الموقع تلقائياً من اسم الشارع والحي والمدينة.</small>
                      </div>
                    )}
                  </div>

                  {showMapPicker && (
                    <MapPickerModal
                      addressQuery={[
                        createForm.street && `شارع ${createForm.street}`,
                        createForm.neighborhood,
                        createForm.city
                      ].filter(Boolean).join(' ')}
                      cityFallback={`${createForm.city} ${createForm.governorate}`}
                      initialLat={createForm.latitude}
                      initialLng={createForm.longitude}
                      onConfirm={(lat, lng) => {
                        setCreateForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
                        setShowMapPicker(false);
                      }}
                      onClose={() => setShowMapPicker(false)}
                    />
                  )}

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
                    <button className="btn-primary" disabled={!createForm.title || !createForm.city || !createForm.neighborhood || !createForm.street || !createForm.building_number} onClick={handleStep2Next}>التالي</button>
                  </div>
                </div>
              )}

              {/* STEP 3: ROOM CONFIGURATION */}
              {createStep === 3 && (
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>تهيئة الغرف والأسعار والعمولة</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>يمكنك إدراج نوع واحد أو أكثر للغرف المتوفرة في الشقة. السعر المطلوب للسرير الفردي فقط.</p>
                  
                  {createForm.room_configurations.map((config, index) => (
                    <div key={index} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'grid', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'center' }}>
                        <strong>تهيئة فئة #{index + 1}</strong>
                        {createForm.room_configurations.length > 1 && (
                          <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => removeRoomConfig(index)}>حذف</button>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ fontSize: '0.75rem' }}>نوع الغرفة</label>
                          <select value={config.room_type} onChange={(e) => updateRoomConfig(index, 'room_type', e.target.value)}>
                            <option value="single">فردية (Single)</option>
                            <option value="double">ثنائية (Double)</option>
                            <option value="triple">ثلاثية (Triple)</option>
                            <option value="quadruple">رباعية (Quadruple)</option>
                          </select>
                        </div>
                        
                        <div style={{ flex: '1 1 100px' }}>
                          <label style={{ fontSize: '0.75rem' }}>عدد الغرف المتاحة</label>
                          <input 
                            type="number" 
                            value={config.count} 
                            onChange={(e) => updateRoomConfig(index, 'count', Number(e.target.value))} 
                            min="1" 
                          />
                        </div>

                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ fontSize: '0.75rem' }}>السعر الشهري للفرد (جنيه)</label>
                          <input 
                            type="number" 
                            value={config.price_per_person} 
                            onChange={(e) => updateRoomConfig(index, 'price_per_person', Number(e.target.value))} 
                            min="0" 
                          />
                        </div>

                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ fontSize: '0.75rem' }}>مبلغ التأمين (اختياري)</label>
                          <input 
                            type="number" 
                            value={config.insurance_price} 
                            placeholder={`${config.price_per_person}`}
                            onChange={(e) => updateRoomConfig(index, 'insurance_price', e.target.value ? Number(e.target.value) : '')} 
                          />
                        </div>

                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ fontSize: '0.75rem' }}>قيمة العمولة (جنيه)</label>
                          <input 
                            type="number" 
                            value={config.commission} 
                            placeholder={`${config.price_per_person * 0.5}`}
                            onChange={(e) => updateRoomConfig(index, 'commission', e.target.value ? Number(e.target.value) : '')} 
                          />
                          <small style={{ color: 'var(--text-light)', fontSize: '0.65rem' }}>القيمة الافتراضية المقترحة ٥٠٪ شهرياً</small>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <input 
                          type="checkbox" 
                          id={`services-${index}`} 
                          checked={config.services_inclusive}
                          onChange={(e) => updateRoomConfig(index, 'services_inclusive', e.target.checked)} 
                        />
                        <label htmlFor={`services-${index}`} style={{ fontSize: '0.85rem', fontWeight: 500, margin: 0, cursor: 'pointer' }}>
                          السعر شامل الخدمات (الكهرباء، المياه، الغاز)
                        </label>
                      </div>
                    </div>
                  ))}

                  <button className="btn-outline" onClick={addRoomConfig} style={{ width: '100%', marginBottom: '1.25rem' }}>➕ إضافة فئة غرفة أخرى</button>

                  <div style={{ display: 'flex', justifySelf: 'space-between', width: '100%' }}>
                    <button className="btn-secondary" onClick={() => setCreateStep(2)}>السابق</button>
                    <button className="btn-primary" onClick={() => setCreateStep(4)}>التالي</button>
                  </div>
                </div>
              )}

              {/* STEP 4: AMENITIES */}
              {createStep === 4 && (
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>المرافق والخدمات المتوفرة</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>قم بتحديد الخدمات المتواجدة داخل الوحدة السكنية وخارجها لتسهيل وصول الباحثين إليها.</p>

                  <h5 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>مرافق سكنية داخلية (Indoor)</h5>
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
                          {amenity.name} {amenity.prechecked && <span style={{ color: 'var(--primary)', fontSize: '0.75rem' }}>(موصى به)</span>}
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
                        onChange={(e) => setCustomAmenity(e.target.value)}
                      />
                      <button type="button" className="btn-secondary" onClick={handleAddCustomAmenity}>إضافة</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifySelf: 'space-between', width: '100%', marginTop: '1rem' }}>
                    <button className="btn-secondary" onClick={() => setCreateStep(3)}>السابق</button>
                    <button className="btn-primary" onClick={() => setCreateStep(5)}>التالي</button>
                  </div>
                </div>
              )}

              {/* STEP 5: MEDIA */}
              {createStep === 5 && (
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>الوسائط المرئية (صور + فيديو)</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>تتطلب المنصة رفع ٥ صور على الأقل وفيديو واحد للوحدة.</p>

                  {/* Photo Upload */}
                  <div className="form-group">
                    <label>صور الوحدة — {createForm.photo_urls.length} مرفوعة (٥ كحد أدنى، ٣٠ كحد أقصى)</label>

                    {/* Thumbnail grid */}
                    {createForm.photo_urls.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {createForm.photo_urls.map((url, idx) => (
                          <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-muted)' }}>
                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                        justifyContent: 'center', border: '2px dashed var(--border)',
                        borderRadius: '12px', padding: '2rem 1rem', cursor: 'pointer',
                        background: 'var(--bg-muted)', color: 'var(--text-muted)',
                        fontSize: '0.875rem', gap: '0.4rem', transition: 'border-color 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <span style={{ fontSize: '2rem' }}>📷</span>
                      <span style={{ fontWeight: 600 }}>اضغط لرفع صور</span>
                      <span style={{ fontSize: '0.75rem' }}>JPG, PNG, WEBP — حد أقصى 10 ميجابايت لكل صورة</span>
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
                              const res = await fetch('http://127.0.0.1:8000/upload/listing-photo', { method: 'POST', body: fd });
                              if (res.ok) {
                                const data = await res.json();
                                newUrls.push(`http://127.0.0.1:8000${data.url}`);
                              }
                            } catch {}
                          }
                          setCreateForm(prev => ({ ...prev, photo_urls: [...prev.photo_urls, ...newUrls] }));
                          if (newUrls.length) showToast(`تم رفع ${newUrls.length} صورة بنجاح ✅`);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <small style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>يمكنك اختيار عدة صور في نفس الوقت.</small>
                  </div>

                  {/* Video URL */}
                  <div className="form-group">
                    <label>رابط الفيديو (فيديو واحد كحد أدنى — YouTube أو Google Drive)</label>
                    <textarea
                      rows="2"
                      placeholder="ضع رابط فيديو واحد في كل سطر..."
                      value={createForm.video_urls.join('\n')}
                      onChange={(e) => setCreateForm({ ...createForm, video_urls: e.target.value.split('\n').filter(Boolean) })}
                    />
                    <small style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>عدد الفيديوهات المرفقة: {createForm.video_urls.length}</small>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '1.5rem' }}>
                    <button className="btn-secondary" onClick={() => setCreateStep(4)}>السابق</button>
                    <button
                      className="btn-primary"
                      disabled={createForm.photo_urls.length < 5 || createForm.video_urls.length < 1}
                      onClick={() => setCreateStep(6)}
                    >
                      التالي
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 6: CHOOSE TIER & SUBMIT */}
              {createStep === 6 && (
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>اختر باقة الإعلان وانشر عقارك 🚀</h4>
                  <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', gap: '1rem', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: createForm.tier === 'regular' ? '#f0fdf4' : 'white', borderColor: createForm.tier === 'regular' ? 'var(--primary)' : 'var(--border-color)' }}>
                      <input type="radio" name="tier" checked={createForm.tier === 'regular'} onChange={() => setCreateForm({ ...createForm, tier: 'regular' })} />
                      <div>
                        <strong>إعلان عادي (Regular Listing) - ١٠٠ جنيه مصري / شهر</strong>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>نشر قياسي للإعلان في ذيل القائمة حسب تاريخ النشر.</p>
                      </div>
                    </label>

                    <label style={{ display: 'flex', gap: '1rem', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: createForm.tier === 'premium' ? '#fffbeb' : 'white', borderColor: createForm.tier === 'premium' ? 'var(--premium-gold)' : 'var(--border-color)' }}>
                      <input type="radio" name="tier" checked={createForm.tier === 'premium'} onChange={() => setCreateForm({ ...createForm, tier: 'premium' })} />
                      <div>
                        <strong>⭐ إعلان مميز (Premium Listing) - ١٥٠ جنيه مصري / شهر</strong>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>أولوية ظهور الإعلان في أعلى نتائج البحث ووضع شارة عقار مميز ملفتة للانتباه.</p>
                      </div>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifySelf: 'space-between', width: '100%' }}>
                    <button className="btn-secondary" onClick={() => setCreateStep(5)}>السابق</button>
                    <button className="btn-primary" onClick={handleCreateSubmit}>نشر الإعلان 🚀</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- DETAILED LISTING MODAL --- */}
      {selectedListingDetail && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <span className={`badge-gender ${selectedListingDetail.listing.gender === 'male' ? 'gender-male' : 'gender-female'}`} style={{ position: 'static', display: 'inline-flex', marginBottom: '0.25rem' }}>
                  {selectedListingDetail.listing.gender === 'male' ? '♂ سكن طلاب' : '♀ سكن طالبات'}
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedListingDetail.listing.title}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>📍 {selectedListingDetail.listing.governorate}، {selectedListingDetail.listing.city}، {selectedListingDetail.listing.neighborhood}</p>
              </div>
              <button className="modal-close" onClick={() => setSelectedListingDetail(null)}>×</button>
            </div>

            <div className="modal-body">
              {/* Media Carousel */}
              <div className="media-carousel">
                <div className="carousel-slide-wrapper">
                  <div className="carousel-slide">
                    {carouselIndex < selectedListingDetail.listing.photo_urls.length ? (
                      <img src={selectedListingDetail.listing.photo_urls[carouselIndex]} alt="" />
                    ) : (
                      <video src={selectedListingDetail.listing.video_urls[carouselIndex - selectedListingDetail.listing.photo_urls.length]} controls />
                    )}
                  </div>
                </div>

                {(selectedListingDetail.listing.photo_urls.length + selectedListingDetail.listing.video_urls.length) > 1 && (
                  <>
                    <button className="carousel-btn carousel-btn-prev" onClick={() => setCarouselIndex(prev => prev === 0 ? selectedListingDetail.listing.photo_urls.length + selectedListingDetail.listing.video_urls.length - 1 : prev - 1)}>▶</button>
                    <button className="carousel-btn carousel-btn-next" onClick={() => setCarouselIndex(prev => prev === selectedListingDetail.listing.photo_urls.length + selectedListingDetail.listing.video_urls.length - 1 ? 0 : prev + 1)}>◀</button>
                  </>
                )}

                <span className="carousel-counter">
                  {carouselIndex + 1} / {selectedListingDetail.listing.photo_urls.length + selectedListingDetail.listing.video_urls.length} (وسائط)
                </span>
              </div>

              {/* Informational columns */}
              <div className="grid-cols-2">
                {/* 1. Unit Info */}
                <div className="details-section">
                  <h3 className="details-title">تفاصيل الإقامة</h3>
                  <p>🔹 <strong>العنوان بالتفصيل:</strong> {formatAddress(selectedListingDetail.listing)}</p>
                  <p>🔹 <strong>عدد الأسرّة المتوفرة:</strong> {selectedListingDetail.listing.available_beds} أسرة</p>
                  {(() => {
                    const { latitude, longitude, address, city } = selectedListingDetail.listing;
                    const hasCoords = latitude != null && longitude != null;
                    const gmSrc = hasCoords
                      ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`
                      : null;
                    const osmSrc = hasCoords
                      ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude-0.006},${latitude-0.004},${longitude+0.006},${latitude+0.004}&layer=mapnik&marker=${latitude},${longitude}`
                      : `https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent((address || '') + ' ' + city)}`;
                    const googleMapsLink = hasCoords
                      ? `https://www.google.com/maps?q=${latitude},${longitude}`
                      : `https://www.google.com/maps/search/${encodeURIComponent((address || '') + ' ' + city)}`;
                    return (
                      <div style={{ marginTop: '1rem', width: '100%', height: '228px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                        <iframe
                          key={gmSrc || osmSrc}
                          src={gmSrc || osmSrc}
                          width="100%"
                          height={200}
                          style={{ border: 0, display: 'block', flex: '0 0 200px' }}
                          allowFullScreen=""
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Map"
                          onError={(e) => { if (gmSrc) e.target.src = osmSrc; }}
                        />
                        <div style={{ height: '28px', flex: '0 0 28px', background: '#f8fafc', fontSize: '0.75rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid var(--border-color)' }}>
                          <a href={googleMapsLink} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>فتح في خرائط جوجل 🗺️</a>
                        </div>
                      </div>
                    );
                  })()}
                  
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <strong>فئات الغرف والأسعار المتاحة:</strong>
                    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {selectedListingDetail.listing.room_configurations?.map((c, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600 }}>{c.room_type === 'single' ? 'غرفة فردية' : c.room_type === 'double' ? 'غرفة ثنائية' : c.room_type === 'triple' ? 'غرفة ثلاثية' : 'غرفة رباعية'} ({c.count || 1} متاح)</span>
                            <strong style={{ color: 'var(--primary)' }}>{c.price_per_person} ج.م / شهر</strong>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {c.commission && <span>💰 عمولة: {c.commission} ج.م</span>}
                            {c.insurance_price ? <span>🛡️ تأمين: {c.insurance_price} ج.م</span> : <span>🛡️ بدون تأمين</span>}
                            {c.services_inclusive ? <span style={{ color: '#16a34a' }}>⚡ شامل الخدمات</span> : <span>🔌 الخدمات غير مشمولة</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Advertiser card */}
                <div className="details-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="details-title" style={{ margin: 0 }}>معلومات المعلن</h3>
                    <button 
                      className="btn-outline" 
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => {
                        const url = window.location.href;
                        const text = `شاهد هذا السكن على سكن:\n${selectedListingDetail.listing.title}\n${selectedListingDetail.listing.address}\n\nالرابط: ${url}`;
                        navigator.clipboard.writeText(text);
                        alert("تم نسخ رابط العقار وتفاصيله بنجاح!");
                      }}
                    >
                      🔗 مشاركة السكن
                    </button>
                  </div>
                  <div className="advertiser-profile-card" style={{ marginTop: '1rem' }}>
                    <div className="avatar-wrapper">
                      {selectedListingDetail.advertiser.profile_photo_url ? (
                        <img src={selectedListingDetail.advertiser.profile_photo_url} className="avatar-img" alt="" />
                      ) : (
                        <span style={{ fontSize: '1.75rem' }}>👤</span>
                      )}
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 700 }}>{selectedListingDetail.advertiser.name}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ background: 'var(--bg-muted)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
                          {selectedListingDetail.advertiser.account_type === 'broker' ? '👔 سمسار عقاري' : '🏠 مالك مباشر'}
                        </span>
                        {selectedListingDetail.listing.tier === 'premium' && <span style={{ color: 'var(--premium-gold)' }}>⭐ معلن مميز</span>}
                      </p>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <span className="rating-stars">{"★".repeat(Math.round(selectedListingDetail.advertiser.avg_rating || 0)) + "☆".repeat(5 - Math.round(selectedListingDetail.advertiser.avg_rating || 0))}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>({selectedListingDetail.advertiser.avg_rating.toFixed(1)})</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <a 
                      className="btn btn-primary" 
                      style={{ textDecoration: 'none', backgroundColor: '#22c55e', color: 'white' }}
                      href={`https://wa.me/${selectedListingDetail.advertiser.phone}?text=${encodeURIComponent(`مرحباً أستاذ ${selectedListingDetail.advertiser.name}، أنا مهتم بوحدتك السكنية المعروضة على منصة سكن في حي ${selectedListingDetail.listing.neighborhood}`)}`}
                      target="_blank" 
                      rel="noreferrer"
                    >
                      تواصل واتساب 💬
                    </a>
                    
                    <a 
                      className="btn btn-secondary" 
                      style={{ textDecoration: 'none', textAlign: 'center' }}
                      href={`tel:${selectedListingDetail.advertiser.phone}`}
                    >
                      اتصال هاتفي 📞
                    </a>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="details-section">
                <h3 className="details-title">الوصف</h3>
                <p style={{ whiteSpace: 'pre-line', color: 'var(--text-muted)' }}>{selectedListingDetail.listing.description}</p>
              </div>

              {/* Category divided Amenities */}
              <div className="details-section">
                <h3 className="details-title">الخدمات والمرافق المتوفرة</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <h5 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>مرافق سكنية داخلية</h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {selectedListingDetail.listing.amenities.filter(a => INDOOR_AMENITIES.some(i => i.name === a)).map(amen => (
                        <span key={amen} className="amenity-badge amenity-essential">{amen}</span>
                      ))}
                      {selectedListingDetail.listing.amenities.filter(a => !INDOOR_AMENITIES.some(i => i.name === a) && !OUTDOOR_AMENITIES.some(o => o.name === a)).map(amen => (
                        <span key={amen} className="amenity-badge">{amen}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>مرافق وخدمات مجاورة</h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {selectedListingDetail.listing.amenities.filter(a => OUTDOOR_AMENITIES.some(o => o.name === a)).map(amen => (
                        <span key={amen} className="amenity-badge">{amen}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Complaint Banner - Only editable for normal users/students or guests */}
              {(!user || isNormalUser) && (
                <div className="complaint-banner">
                  <div>
                    ⚠️ إذا خالف المعلن أي من التفاصيل المعلنة في السعر أو العمولة، قدّم شكوى من خلال المنصة وسيتم اتخاذ الإجراءات اللازمة.
                  </div>
                  <button className="btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleOpenComplaintForm}>تقديم شكوى 📄</button>
                </div>
              )}

              {/* RATINGS SECTION */}
              <div className="details-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div className="tabs-header" style={{ marginBottom: 0 }}>
                    <button className={`tab-btn ${detailRatingTab === 'property' ? 'active' : ''}`} onClick={() => setDetailRatingTab('property')}>تقييمات العقار السكني ({selectedListingDetail.property_ratings.length})</button>
                    <button className={`tab-btn ${detailRatingTab === 'advertiser' ? 'active' : ''}`} onClick={() => setDetailRatingTab('advertiser')}>تقييمات أمانة المعلن ({selectedListingDetail.advertiser_ratings.length})</button>
                  </div>
                  
                  {(!user || isNormalUser) ? (
                    <button className="btn-outline" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }} onClick={handleOpenRatingForm}>أضف تقييمك ✍️</button>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: 600 }}>التقييمات والشكاوى متاحة للطلاب والمستخدمين العاديين فقط</span>
                  )}
                </div>

                {/* Rating creation form overlay within listing */}
                {showRatingForm && isNormalUser && (
                  <form onSubmit={handleRatingSubmit} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                    <h4 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>إضافة تقييم جديد لـ {detailRatingTab === 'property' ? 'العقار السكني' : 'أمانة وتواصل المعلن'}</h4>
                    
                    <div className="form-group">
                      <label>التقييم بالنجوم</label>
                      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '1.5rem', color: '#fbbf24', cursor: 'pointer' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} onClick={() => setRatingInput({ ...ratingInput, star_count: star })}>
                            {ratingInput.star_count >= star ? '★' : '☆'}
                          </span>
                        ))}
                      </div>
                    </div>

                    {detailRatingTab === 'property' && (
                      <div className="form-group">
                        <label>عبارات تقييم سريعة مقترحة لتقييمك</label>
                        <div className="preset-tags-container">
                          {getPresetOptions(ratingInput.star_count).map(tag => (
                            <span 
                              key={tag} 
                              className="preset-tag"
                              onClick={() => setRatingInput(prev => ({ ...prev, review_text: prev.review_text ? `${prev.review_text} - ${tag}` : tag }))}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label>التعليق المكتوب {detailRatingTab === 'advertiser' && <span style={{ color: 'red' }}>(٢٠ حرف كحد أدنى)</span>}</label>
                      <textarea 
                        rows="3" 
                        placeholder={detailRatingTab === 'advertiser' ? "اكتب تجربتك مع المعلن. اذكر السبب بوضوح." : "تفاصيل التقييم (اختياري)..."}
                        value={ratingInput.review_text}
                        onChange={(e) => setRatingInput({ ...ratingInput, review_text: e.target.value })}
                        required={detailRatingTab === 'advertiser'}
                      />
                    </div>

                    {detailRatingTab === 'property' && (
                      <div className="form-group">
                        <label>صور العقار المرفقة مع التقييم (اختياري - حتى ٥ صور)</label>
                        <textarea 
                          rows="2" 
                          placeholder="ضع روابط الصور المرفقة (رابط واحد لكل سطر)..."
                          value={ratingInput.photo_urls.join('\n')}
                          onChange={(e) => setRatingInput({ ...ratingInput, photo_urls: e.target.value.split('\n').filter(Boolean) })}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-secondary" onClick={() => setShowRatingForm(false)}>إلغاء</button>
                      <button type="submit" className="btn-primary">نشر التقييم فوراً 🚀</button>
                    </div>
                  </form>
                )}

                {/* Complaint Form Modal */}
                {showComplaintForm && isNormalUser && (
                  <form onSubmit={handleComplaintSubmit} style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                    <h4 style={{ fontWeight: 700, color: '#b45309', marginBottom: '0.75rem' }}>تقديم بلاغ شكوى رسمي لمشرفي المنصة</h4>
                    
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
                      <label>تفاصيل الشكوى والواقعة (٢٠ حرف كحد أدنى للتوضيح)</label>
                      <textarea 
                        rows="3" 
                        placeholder="اشرح الواقعة بالتفصيل لمساعدتنا في اتخاذ الإجراء المناسب..."
                        value={complaintInput.description}
                        onChange={(e) => setComplaintInput({ ...complaintInput, description: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>روابط لقطات شاشة إثبات الشكوى (اختياري - حتى ٣ لقطات)</label>
                      <textarea 
                        rows="2" 
                        placeholder="روابط لقطات شاشة الإثبات (رابط واحد بكل سطر)..."
                        value={complaintInput.evidence_urls.join('\n')}
                        onChange={(e) => setComplaintInput({ ...complaintInput, evidence_urls: e.target.value.split('\n').filter(Boolean) })}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-secondary" onClick={() => setShowComplaintForm(false)}>إلغاء</button>
                      <button type="submit" className="btn-danger">إرسال البلاغ للتحقيق ⚠️</button>
                    </div>
                  </form>
                )}

                {/* Ratings list view */}
                <div>
                  {detailRatingTab === 'property' ? (
                    selectedListingDetail.property_ratings.length === 0 ? (
                      <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '1rem' }}>لا توجد تقييمات مسجلة لهذا السكن بعد.</p>
                    ) : (
                      selectedListingDetail.property_ratings.map(r => (
                        <div key={r.id} className="rating-card">
                          <div className="rating-card-header">
                            <span className="rating-stars">{"★".repeat(r.star_count) + "☆".repeat(5 - r.star_count)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>🗓️ {new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                          </div>
                          {r.review_text && <p className="rating-review-text">{r.review_text}</p>}
                          {r.photo_urls && r.photo_urls.length > 0 && (
                            <div className="rating-photos-row">
                              {r.photo_urls.map((photo, idx) => (
                                <img key={idx} className="rating-photo" src={photo} alt="" />
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )
                  ) : (
                    selectedListingDetail.advertiser_ratings.length === 0 ? (
                      <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '1rem' }}>لا توجد تقييمات لأمانة المعلن بعد.</p>
                    ) : (
                      selectedListingDetail.advertiser_ratings.map(r => (
                        <div key={r.id} className="rating-card">
                          <div className="rating-card-header">
                            <span className="rating-stars">{"★".repeat(r.star_count) + "☆".repeat(5 - r.star_count)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>🗓️ {new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                          </div>
                          <p className="rating-review-text">{r.review_text}</p>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
