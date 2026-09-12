import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import AppointmentsDaily from './AppointmentsDaily';
import PageHelpButton from './common/PageHelpButton';
import { Calendar, Clock, User, Phone, Plus, ChevronLeft, ChevronRight, List, Grid, X, Tag, Gift, CheckCircle, CheckCircle2, Star, PhoneCall, Copy, Check, Share2, Layers, ChevronUp, Sparkles } from 'lucide-react';

interface Appointment {
  id: string;
  npsScore?: number;
  customerName: string;
  customerPhone: string;
  callerPhone?: string;
  startTime: string;
  endTime: string;
  status: string;
  promoCode?: string;
  staffId?: string;
  staff?: { name: string };
  contactLevel?: string;
  notes?: string;
  callDuration?: number;
  callSummary?: string;
  actionItems?: string;
  isProcessed?: boolean;
  callLogId?: string;
  service?: {
    name: string;
    id: string;
  };
}

const COLOR_CODES = [
  'bg-blue-600 border-blue-800',
  'bg-emerald-600 border-emerald-800',
  'bg-purple-600 border-purple-800',
  'bg-rose-600 border-rose-800',
  'bg-amber-600 border-amber-800',
  'bg-primary border-surface-800'
];

export default function Appointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [businessProfile, setBusinessProfile] = useState<string>('solo');
  const [bookingMode, setBookingMode] = useState<string>('hourly');
  const [personalSchedule, setPersonalSchedule] = useState<any>(null);
  const [annualEvents, setAnnualEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'list' | 'schedule' | 'month'>('schedule');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthDate, setMonthDate] = useState(new Date());
  const [expandedClusterKey, setExpandedClusterKey] = useState<string | null>(null);
  
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    startTime: '',
    endTime: '',
    serviceId: '',
    staffId: '',
    contactLevel: 'MEETING'
  });

  const loadData = async () => {
    try {
      const [appRes, svcRes, staffRes, tenantRes, eventsRes] = await Promise.all([
        fetch('/api/appointments'),
        fetch('/api/services'),
        fetch('/api/staff'),
        fetch('/api/tenant'),
        fetch('/api/annual-events')
      ]);
      const appData = await appRes.json();
      const svcData = await svcRes.json();
      const staffData = await staffRes.json();
      const tenantData = await tenantRes.json();
      let eventsData = [];
      try { eventsData = await eventsRes.json(); } catch(e) {}
      
      setAppointments(Array.isArray(appData) ? appData : []);
      setServices(Array.isArray(svcData) ? svcData : []);
      setStaffList(Array.isArray(staffData) ? staffData : []);
      setBusinessProfile(tenantData?.businessProfile || 'solo');
      setBookingMode(tenantData?.bookingMode || 'hourly');
      setPersonalSchedule(tenantData?.personalSchedule || null);
      setAnnualEvents(Array.isArray(eventsData) ? eventsData : []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      const isNew = !selectedAppt || selectedAppt.id === 'new';
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/appointments' : `/api/appointments/${selectedAppt.id}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSelectedAppt(null);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Błąd zapisu wizyty.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!selectedAppt || selectedAppt.id === 'new') return;
    if (!confirm('Czy na pewno chcesz usunąć tę rezerwację?')) return;
    try {
      const res = await fetch(`/api/appointments/${selectedAppt.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedAppt(null);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (title: string, text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopy(text, 'share-fallback');
        }
      }
    } else {
      handleCopy(text, 'share-fallback');
    }
  };

  const handleToggleProcessed = async (apptId: string, currentProcessed: boolean) => {
    const targetStatus = !currentProcessed;
    if (selectedAppt && selectedAppt.id === apptId) {
      setSelectedAppt({ ...selectedAppt, isProcessed: targetStatus });
    }
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, isProcessed: targetStatus } : a));

    try {
      await fetch(`/api/appointments/${apptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isProcessed: targetStatus })
      });
    } catch (err) {
      console.error('Błąd aktualizacji statusu:', err);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const changeDay = (offset: number) => {
    setExpandedClusterKey(null);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + offset);
    setCurrentDate(newDate);
  };

  const getAppointmentsForCurrentDate = () => {
    return appointments.filter(app => {
      const appDate = new Date(app.startTime);
      return appDate.toDateString() === currentDate.toDateString();
    });
  };

  const getAppointmentsForDate = (d: Date) => {
    const dStr = d.toDateString();
    return appointments.filter(app => new Date(app.startTime).toDateString() === dStr);
  };

  const getDayEventsMeta = (d: Date) => {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const dayVal = m * 100 + day;

    return annualEvents.filter(ev => {
      if (!ev.endMonth || !ev.endDay || (ev.endMonth === ev.month && ev.endDay === ev.day)) {
        return ev.month === m && ev.day === day;
      }
      const startVal = ev.month * 100 + ev.day;
      const endVal = ev.endMonth * 100 + ev.endDay;
      if (startVal <= endVal) {
        return dayVal >= startVal && dayVal <= endVal;
      } else {
        return dayVal >= startVal || dayVal <= endVal;
      }
    });
  };

  const isDateHolidayOrVacation = (d: Date) => {
    const dayEvents = getDayEventsMeta(d);
    return dayEvents.some(ev => 
      ['statutory', 'vacation', 'holiday'].includes(ev.category) || 
      /urlop|wolne|święto|swieto/i.test(ev.title)
    );
  };

  const getSlotZone = (timeStr: string, dateObj: Date): 'work' | 'private' | 'focus' | 'off' => {
    if (businessProfile !== 'personal' || !personalSchedule) {
      return 'work';
    }

    const isHoliday = isDateHolidayOrVacation(dateObj);
    // Jeśli święto/urlop -> reguła Niedzieli (day=0)
    const effectiveDay = isHoliday ? 0 : dateObj.getDay();

    // 1. Czas Skupienia
    const focusBlocks = Array.isArray(personalSchedule.focusBlocks) ? personalSchedule.focusBlocks : [];
    const inFocus = focusBlocks.some((fb: any) => {
      if (!Array.isArray(fb.days) || !fb.days.includes(effectiveDay)) return false;
      const dt = fb.dayTimes?.[effectiveDay] || fb.dayTimes?.[String(effectiveDay)];
      const bStart = dt?.start || fb.start;
      const bEnd = dt?.end || fb.end;
      if (!bStart || !bEnd) return false;
      return timeStr >= bStart && timeStr < bEnd;
    });

    if (inFocus) return 'focus';

    // 2. Harmonogram dni
    const dayKey = String(effectiveDay);
    const dayConf = personalSchedule.days?.[dayKey] || personalSchedule.days?.[effectiveDay];

    let isWork = false;
    let isPrivate = false;

    if (dayConf) {
      isWork = Boolean(dayConf.workEnabled) && timeStr >= (dayConf.workStart || "08:00") && timeStr < (dayConf.workEnd || "16:00");
      isPrivate = Boolean(dayConf.privateEnabled) && timeStr >= (dayConf.privateStart || "16:00") && timeStr < (dayConf.privateEnd || "20:00");
    } else {
      const workDays = personalSchedule.workDays || [1, 2, 3, 4, 5];
      const privateDays = personalSchedule.privateDays || [1, 2, 3, 4, 5, 6];
      isWork = workDays.includes(effectiveDay) && timeStr >= (personalSchedule.workStart || "08:00") && timeStr < (personalSchedule.workEnd || "16:00");
      isPrivate = privateDays.includes(effectiveDay) && timeStr >= (personalSchedule.privateStart || "16:00") && timeStr < (personalSchedule.privateEnd || "20:00");
    }

    if (isWork) return 'work';
    if (isPrivate) return 'private';
    return 'off';
  };

  const getDaysForMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // 0 = Pn, ..., 6 = Nd
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        isCurrentMonth: true
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false
      });
    }

    return days;
  };

  const START_HOUR = 6;
  const END_HOUR = 22;
  const timeSlots: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  const isWorkingHour = (col: any, timeStr: string) => {
    if (col.id === 'solo') return true;
    
    const day = currentDate.getDay().toString();
    
    let scheduleObj = col.schedule;
    if (typeof scheduleObj === 'string') {
      try { scheduleObj = JSON.parse(scheduleObj); } catch(e) {}
    }
    
    const schedule = scheduleObj?.[day];
    if (!schedule || !schedule.isWorking) return false;

    const [startH, startM] = (schedule.start || '09:00').split(':').map(Number);
    const [endH, endM] = (schedule.end || '17:00').split(':').map(Number);
    const [slotH, slotM] = timeStr.split(':').map(Number);
    
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    const slotMin = slotH * 60 + slotM;
    
    return slotMin >= startMin && slotMin < endMin;
  };

  const openAddModal = (time?: string, staffId?: string) => {
    const now = new Date();
    const start = new Date(currentDate);
    if (time) {
      const [hh, mm] = time.split(':').map(Number);
      start.setHours(hh, mm, 0, 0);
    } else {
      // Początek następnej godziny od teraz
      start.setHours(now.getHours() + 1, 0, 0, 0);
    }
    // Domyślnie +30 minut
    const end = new Date(start.getTime() + 30 * 60000);

    const tzStart = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    const tzEnd = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0,16);

    setSelectedAppt({ id: 'new', customerName: '', customerPhone: '', startTime: tzStart, endTime: tzEnd, status: 'confirmed' });
    setIsEditing(true);
    setFormData({
      customerName: '',
      customerPhone: '',
      startTime: tzStart,
      endTime: tzEnd,
      serviceId: services[0]?.id || '',
      staffId: staffId || (staffList[0]?.id || ''),
      contactLevel: 'MEETING'
    });
  };

  const handleContactLevelChange = (lvlId: string) => {
    let durationMin = 30;
    if (lvlId === 'MEETING') durationMin = 60;
    else if (lvlId === 'CALL') durationMin = 15;
    else if (lvlId === 'TASK') durationMin = 0;

    let newEndTime = formData.endTime;
    if (formData.startTime) {
      const startDate = new Date(formData.startTime);
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate.getTime() + durationMin * 60000);
        newEndTime = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
    }

    setFormData(prev => ({
      ...prev,
      contactLevel: lvlId,
      endTime: newEndTime
    }));
  };

  const openEditModal = (app: Appointment) => {
    setSelectedAppt(app);
    setIsEditing(false);
    
    const start = new Date(app.startTime);
    const end = new Date(app.endTime);
    const tzStart = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    const tzEnd = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0,16);

    setFormData({
      customerName: app.customerName,
      customerPhone: app.customerPhone,
      startTime: tzStart,
      endTime: tzEnd,
      serviceId: app.service?.id || services[0]?.id || '',
      staffId: app.staffId || '',
      contactLevel: app.contactLevel || 'MEETING'
    });
  };

  const getColorCode = (serviceId: string) => {
    if (!serviceId) return COLOR_CODES[5];
    const index = services.findIndex(s => s.id === serviceId);
    if (index === -1) return COLOR_CODES[5];
    return COLOR_CODES[index % COLOR_CODES.length];
  };

  const columns = (businessProfile !== 'solo' && businessProfile !== 'personal' && staffList.length > 0) 
    ? staffList 
    : [{ id: 'solo', name: businessProfile === 'personal' ? 'Mój Kalendarz' : 'Kalendarz Główny' }];
    
  useEffect(() => {
    if (loading || view !== 'schedule') return;
    let targetIndex = -1;
    const isToday = currentDate.toDateString() === new Date().toDateString();
    if (isToday) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = Math.max(START_HOUR * 60, nowMinutes - 30);
      targetIndex = Math.floor((targetMinutes - START_HOUR * 60) / 30);
    } else {
      for (let i = 0; i < timeSlots.length; i++) {
        if (columns.some(col => isWorkingHour(col, timeSlots[i]))) {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex >= 0 && scrollContainerRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: targetIndex * 48, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [currentDate, loading, columns.length, view]);

  if (loading) {
    return <div className="p-8 text-surface-500 animate-pulse">Ładowanie rezerwacji...</div>;
  }
  const dailyApps = getAppointmentsForCurrentDate();

  // Helper to determine the 30-minute slot key for any timestamp
  const getSlotKeyFromDate = (d: Date): string => {
    const h = d.getHours();
    const m = d.getMinutes() < 30 ? '00' : '30';
    return `${h.toString().padStart(2, '0')}:${m}`;
  };

  interface EventCluster {
    id: string;
    colId: string;
    slotKey: string;
    appointments: Appointment[];
    earliestStart: Date;
    latestEnd: Date;
  }

  const clusterAppointments = (apps: Appointment[], colId: string): EventCluster[] => {
    if (!apps || apps.length === 0) return [];
    
    // Sort chronologically
    const sorted = [...apps].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    const clusters: EventCluster[] = [];
    let currentGroup: Appointment[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const nextApp = sorted[i];
      const nextStart = new Date(nextApp.startTime);

      // Check if nextApp falls in the same 30-min slot as any app in currentGroup,
      // or if its start time overlaps with the running max end time of currentGroup
      const sameSlot = currentGroup.some(item => {
        const itemStart = new Date(item.startTime);
        return getSlotKeyFromDate(itemStart) === getSlotKeyFromDate(nextStart);
      });

      const maxEnd = Math.max(...currentGroup.map(item => new Date(item.endTime).getTime()));
      const overlaps = nextStart.getTime() < maxEnd;

      if (sameSlot || overlaps) {
        currentGroup.push(nextApp);
      } else {
        const eStart = new Date(Math.min(...currentGroup.map(a => new Date(a.startTime).getTime())));
        const lEnd = new Date(Math.max(...currentGroup.map(a => new Date(a.endTime).getTime())));
        const slotKey = getSlotKeyFromDate(eStart);
        clusters.push({
          id: `${colId}_${slotKey}`,
          colId,
          slotKey,
          appointments: currentGroup,
          earliestStart: eStart,
          latestEnd: lEnd
        });
        currentGroup = [nextApp];
      }
    }

    if (currentGroup.length > 0) {
      const eStart = new Date(Math.min(...currentGroup.map(a => new Date(a.startTime).getTime())));
      const lEnd = new Date(Math.max(...currentGroup.map(a => new Date(a.endTime).getTime())));
      const slotKey = getSlotKeyFromDate(eStart);
      clusters.push({
        id: `${colId}_${slotKey}`,
        colId,
        slotKey,
        appointments: currentGroup,
        earliestStart: eStart,
        latestEnd: lEnd
      });
    }

    return clusters;
  };

  const allClustersByCol: Record<string, EventCluster[]> = {};
  columns.forEach(col => {
    const apps = dailyApps.filter(a => {
      if (businessProfile === 'solo') return true;
      if (col.id === 'solo') return !a.staffId;
      return a.staffId === col.id;
    });
    allClustersByCol[col.id] = clusterAppointments(apps, col.id);
  });

  let activeExpandedCluster: EventCluster | null = null;
  if (expandedClusterKey) {
    for (const colId of Object.keys(allClustersByCol)) {
      const found = allClustersByCol[colId].find(c => c.id === expandedClusterKey);
      if (found && found.appointments.length > 1) {
        activeExpandedCluster = found;
        break;
      }
    }
  }

  const slotHeights: Record<string, number> = {};
  const slotTopMap: Record<string, number> = {};
  let accumulatedTop = 0;

  for (const time of timeSlots) {
    let h = 48; // Standard 48px
    if (activeExpandedCluster && activeExpandedCluster.slotKey === time) {
      // Dynamic slot height to comfortably fit all individual event cards
      h = Math.max(48, 88 + activeExpandedCluster.appointments.length * 86);
    }
    slotHeights[time] = h;
    slotTopMap[time] = accumulatedTop;
    accumulatedTop += h;
  }

  const getTopPxForSlot = (slotKey: string) => {
    if (slotTopMap[slotKey] !== undefined) return slotTopMap[slotKey];
    const [hh, mm] = slotKey.split(':').map(Number);
    const hourOffset = (hh + mm / 60) - START_HOUR;
    return hourOffset * 96;
  };

  const POLISH_MONTHS_GENITIVE = [
    'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
    'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
  ];

  const getAnnualEventVisuals = (ev: { category?: string; title: string }) => {
    const cat = (ev.category || '').toLowerCase();
    const title = (ev.title || '').toLowerCase();

    if (cat === 'birthday' || title.includes('urodzin')) {
      return {
        emoji: '🎂',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
        label: 'Urodziny'
      };
    }
    if (cat === 'vacation' || title.includes('urlop') || title.includes('wolne') || title.includes('majówk') || title.includes('majowk')) {
      return {
        emoji: '🏖️',
        badgeClass: 'bg-rose-50 text-rose-900 border-rose-300',
        label: 'Urlop'
      };
    }
    if (cat === 'anniversary' || title.includes('rocznic') || title.includes('ślub') || title.includes('slub')) {
      return {
        emoji: '💍',
        badgeClass: 'bg-pink-50 text-pink-900 border-pink-300',
        label: 'Rocznica'
      };
    }
    if (cat === 'tax' || title.includes('zus') || title.includes('vat') || title.includes('podatek') || title.includes('skarbow')) {
      return {
        emoji: '💰',
        badgeClass: 'bg-blue-50 text-blue-900 border-blue-300',
        label: 'Podatki/ZUS'
      };
    }
    if (cat === 'statutory' || title.includes('święto') || title.includes('swieto') || title.includes('konstytucj') || title.includes('niepodleg') || title.includes('narodow') || title.includes('nowy rok') || title.includes('króli') || title.includes('kroli')) {
      return {
        emoji: '🇵🇱',
        badgeClass: 'bg-purple-50 text-purple-900 border-purple-300',
        label: 'Święto'
      };
    }
    return {
      emoji: '📌',
      badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
      label: 'Ważna data'
    };
  };

  const currentDayEvents = getDayEventsMeta(currentDate);

  const monthImportantEvents = annualEvents.filter(ev => {
    const currentM = monthDate.getMonth() + 1;
    if (!ev.endMonth || !ev.endDay || (ev.endMonth === ev.month && ev.endDay === ev.day)) {
      return ev.month === currentM;
    }
    if (ev.month <= ev.endMonth) {
      return ev.month <= currentM && ev.endMonth >= currentM;
    } else {
      return currentM >= ev.month || currentM <= ev.endMonth;
    }
  }).sort((a, b) => {
    const dayA = a.month === monthDate.getMonth() + 1 ? a.day : 1;
    const dayB = b.month === monthDate.getMonth() + 1 ? b.day : 1;
    return dayA - dayB;
  });

  if (bookingMode === 'daily' && businessProfile === 'facility') {
    return <AppointmentsDaily appointments={appointments} services={services} staffList={staffList} loadData={loadData} loading={loading} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative w-full min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-surface-900 tracking-tight">
              {businessProfile === 'personal' ? 'Wydarzenia' : 'Rezerwacje'}
            </h2>
            <PageHelpButton
              title={businessProfile === 'personal' ? "Kalendarz i Grafik Wydarzeń" : "Kalendarz i Rezerwacje Klientów"}
              description={
                businessProfile === 'personal'
                  ? "Zarządzaj swoim grafikiem dobowym, spotkaniami, rozmowami telefonicznymi oraz blokami Czasu Skupienia."
                  : "Zarządzaj terminami wizyt, kalendarzem personelu i rezerwacjami klientów."
              }
              tips={
                businessProfile === 'personal'
                  ? [
                      "Grafik dobowy: Oś czasu z ergonomicznymi kafelkami powiększonymi o 20% oraz zwężonym słupkiem godzin dla optymalnej wygody na telefonie.",
                      "Ważne Daty: Baner całodzienny na samej górze grafiku przypomina o urodzinach, rocznicach, podatkach czy urlopach w danym dniu.",
                      "Widok miesięczny: Kompaktowa siatka z kolorowymi plakietkami emoji oraz pełną interaktywną listą ważnych dat miesiąca pod kalendarzem.",
                      "Ochrona Czasu Skupienia: Asystent nigdy nie zaoferuje dzwoniącemu terminu kolidującego z Twoimi lekcjami lub blokami skupienia (pełna weryfikacja backendowa)."
                    ]
                  : [
                      "Grafik dobowy: Przejrzysty podgląd slotów czasowych pracowników.",
                      "Przypisanie usług: Asystent automatycznie sprawdza czas trwania usługi i wolne okienka w grafiku personelu.",
                      "Dni wolne: Wizyty nie będą oferowane w święta i podczas zdefiniowanych urlopów."
                    ]
              }
              guideSectionId={businessProfile === 'personal' ? "personal-schedule-zones" : "team-assignment"}
              nextStepRecommendation={
                businessProfile === 'personal'
                  ? {
                      text: "Dostosuj Czas Skupienia i Strefy Dostępności w Ustawieniach",
                      path: "/dashboard/settings",
                      actionLabel: "Ustawienia Dostępności"
                    }
                  : {
                      text: "Zarządzaj Zespołem i Grafikami Pracy",
                      path: "/dashboard/settings",
                      actionLabel: "Grafiki Zespołu"
                    }
              }
            />
          </div>
          <p className="text-surface-500 mt-1">
            {businessProfile === 'personal' ? 'Zarządzaj kalendarzem spotkań i zadań.' : 'Zarządzaj kalendarzem i wizytami swoich klientów.'}
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-start lg:self-auto">
          <button 
            onClick={() => loadData()}
            className="p-2 bg-surface-100 hover:bg-surface-200 text-surface-600 rounded-lg transition-colors border border-surface-200 shadow-sm"
            title="Odśwież kalendarz"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          
          <div className="bg-white border border-surface-200 rounded-lg flex p-1 shadow-sm">
            {businessProfile !== 'personal' && (
              <button 
                onClick={() => setView('list')}
                className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${view === 'list' ? 'bg-surface-100 text-surface-900' : 'text-surface-400 hover:text-surface-700'}`}
                title="Widok listy"
              >
                <List className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => setView('schedule')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${view === 'schedule' ? 'bg-surface-100 text-surface-900' : 'text-surface-400 hover:text-surface-700'}`}
              title="Widok grafiku dobowego"
            >
              <Grid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                setMonthDate(new Date(currentDate));
                setView('month');
              }}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${view === 'month' ? 'bg-surface-100 text-surface-900' : 'text-surface-400 hover:text-surface-700'}`}
              title="Widok miesięczny"
            >
              <Calendar className="w-5 h-5" />
            </button>
          </div>
          
          <button 
            onClick={() => openAddModal()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-surface-800 hover:text-white transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {businessProfile === 'personal' ? 'Dodaj wydarzenie' : 'Dodaj rezerwację'}
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {appointments.map(app => (
            <div 
              key={app.id} 
              onClick={() => openEditModal(app)}
              className={`glass-card glass-card-hover rounded-xl p-4 relative overflow-hidden group cursor-pointer ${app.status === 'confirmed_by_client' ? 'border-2 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-xl font-serif text-surface-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-gold-500" />
                  {formatTime(app.startTime)}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {app.contactLevel === 'CALL' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">📞 Telefon</span>
                  )}
                  {app.contactLevel === 'TASK' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">📌 Zadanie</span>
                  )}
                  {(!app.contactLevel || app.contactLevel === 'MEETING') && businessProfile === 'personal' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">🤝 Spotkanie</span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 uppercase tracking-wide">
                    {app.status}
                  </span>
                </div>
              </div>
              <div className="text-xs font-medium text-surface-500 capitalize mb-3">{formatDate(app.startTime)}</div>
              
              <div className="space-y-1.5 bg-surface-50 p-2.5 rounded-lg border border-surface-100">
                <div className="flex items-center gap-2 text-surface-800">
                  <User className="w-3.5 h-3.5 text-surface-400" />
                  <span className="text-sm font-medium truncate">{app.customerName}</span>
                </div>
                <div className="flex items-center gap-2 text-surface-600">
                  <Phone className="w-3.5 h-3.5 text-surface-400" />
                  <span className="text-xs">{app.customerPhone}</span>
                </div>
                {app.service?.name && (
                  <div className="flex items-center gap-2 text-surface-600 border-t border-surface-200/60 pt-1.5 mt-1.5">
                    <Tag className="w-3.5 h-3.5 text-surface-400" />
                    <span className="text-xs font-medium text-surface-800 truncate">{app.service.name}</span>
                  </div>
                )}
                {app.staff?.name && (
                  <div className="flex items-center gap-2 text-surface-600">
                    <User className="w-3.5 h-3.5 text-surface-400" />
                    <span className="text-xs font-medium truncate">{app.staff.name}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-surface-100 flex items-center justify-between text-xs text-primary font-medium">
                <span className="text-surface-500 text-[11px]">Dotknij, aby zarządzać</span>
                <span className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">Szczegóły →</span>
              </div>
            </div>
          ))}
          {appointments.length === 0 && (
            <div className="col-span-full py-12 text-center text-surface-500 glass-card rounded-2xl">
              Brak nadchodzących rezerwacji.
            </div>
          )}
        </div>
      ) : view === 'month' ? (
        <div className="glass-card rounded-2xl shadow-sm border border-surface-200/60 overflow-hidden flex flex-col">
          {/* Header nawigacji po miesiącach */}
          <div className="bg-surface-50 border-b border-surface-200 p-4 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const d = new Date(monthDate);
                  d.setMonth(d.getMonth() - 1);
                  setMonthDate(d);
                }} 
                className="p-2 hover:bg-surface-200 rounded-lg text-surface-600 transition-colors cursor-pointer"
                title="Poprzedni miesiąc"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-serif text-xl font-bold text-surface-900 capitalize">
                {monthDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
              </h3>
              <button 
                onClick={() => {
                  const d = new Date(monthDate);
                  d.setMonth(d.getMonth() + 1);
                  setMonthDate(d);
                }} 
                className="p-2 hover:bg-surface-200 rounded-lg text-surface-600 transition-colors cursor-pointer"
                title="Następny miesiąc"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const now = new Date();
                  setMonthDate(new Date(now));
                  setCurrentDate(new Date(now));
                }}
                className="text-xs font-semibold text-primary hover:text-surface-900 bg-surface-100 hover:bg-surface-200 px-3 py-1.5 rounded-lg transition border border-surface-200 cursor-pointer"
              >
                Bieżący miesiąc
              </button>
            </div>
          </div>

          {/* Dni tygodnia */}
          <div className="grid grid-cols-7 border-b border-surface-200 bg-surface-50/80 text-center py-2.5 text-xs font-bold text-surface-600">
            <div>Pon</div>
            <div>Wt</div>
            <div>Śr</div>
            <div>Czw</div>
            <div>Pt</div>
            <div className="text-amber-700">Sob</div>
            <div className="text-amber-700">Nd</div>
          </div>

          {/* Siatka dni miesiąca */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-surface-200/60 bg-white min-h-[350px] sm:min-h-[460px]">
            {getDaysForMonth(monthDate.getFullYear(), monthDate.getMonth()).map((cell, idx) => {
              const cellDay = cell.date.getDate();
              const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
              const isToday = cell.date.toDateString() === new Date().toDateString();
              const isSelected = cell.date.toDateString() === currentDate.toDateString();
              const dayApps = getAppointmentsForDate(cell.date);
              const dayEvents = getDayEventsMeta(cell.date);
              const hasHoliday = isDateHolidayOrVacation(cell.date);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentDate(cell.date);
                    setView('schedule');
                  }}
                  className={`p-1.5 sm:p-2 min-h-[64px] sm:min-h-[78px] flex flex-col justify-between transition-colors cursor-pointer group relative ${
                    !cell.isCurrentMonth 
                      ? 'bg-surface-50/40 text-surface-400 opacity-60' 
                      : isWeekend 
                        ? 'bg-amber-50/20 hover:bg-amber-50/40' 
                        : 'bg-white hover:bg-surface-50/80'
                  } ${hasHoliday ? 'ring-1 ring-inset ring-rose-300 bg-rose-50/25' : (dayEvents.length > 0 ? 'ring-1 ring-inset ring-amber-300 bg-amber-50/20' : '')}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs font-bold transition ${
                      isToday 
                        ? 'bg-primary text-primary-foreground shadow-xs' 
                        : isSelected 
                          ? 'border border-primary text-primary font-black' 
                          : isWeekend 
                            ? 'text-amber-800' 
                            : 'text-surface-700'
                    }`}>
                      {cellDay}
                    </span>

                    {dayApps.length > 0 && (
                      <span className="text-[10px] sm:text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full sm:rounded-md">
                        <span className="sm:hidden">{dayApps.length}</span>
                        <span className="hidden sm:inline">{dayApps.length} {dayApps.length === 1 ? 'wpis' : 'wpisy'}</span>
                      </span>
                    )}
                  </div>

                  {/* Wskaźniki ważnych dat na mobile - czytelne emoji i nazwy zamiast anonimowej czerwonej kropki */}
                  {dayEvents.length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-0.5 sm:hidden overflow-hidden w-full">
                      {dayEvents.slice(0, 1).map(ev => {
                        const visual = getAnnualEventVisuals(ev);
                        return (
                          <div
                            key={ev.id}
                            className={`text-[9px] leading-tight px-1 py-0.5 rounded font-semibold border truncate flex items-center gap-0.5 shadow-2xs ${visual.badgeClass}`}
                            title={ev.title}
                          >
                            <span className="shrink-0 text-[10px] leading-none">{visual.emoji}</span>
                            <span className="truncate">{ev.title}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 1 && (
                        <div className="text-[8px] font-bold text-amber-800 leading-none px-0.5">
                          +{dayEvents.length - 1} więcej
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kropki rezerwacji na mobile jeśli brak ważnych dat */}
                  {dayApps.length > 0 && dayEvents.length === 0 && (
                    <div className="flex items-center gap-1 mt-1 sm:hidden flex-wrap">
                      {dayApps.slice(0, 3).map((_, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      ))}
                      {dayApps.length > 3 && (
                        <span className="text-[9px] font-bold text-blue-600 leading-none">+</span>
                      )}
                    </div>
                  )}

                  {/* Etykiety świąt / ważnych dat na desktopie */}
                  <div className="space-y-1 mt-1 flex-1 overflow-hidden hidden sm:block">
                    {dayEvents.map(ev => {
                      const visual = getAnnualEventVisuals(ev);
                      return (
                        <div
                          key={ev.id}
                          className={`text-[10px] truncate px-1.5 py-0.5 rounded font-medium border flex items-center gap-1 ${visual.badgeClass}`}
                          title={ev.title}
                        >
                          <span>{visual.emoji}</span>
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}

                    {dayApps.slice(0, 2).map(app => (
                      <div
                        key={app.id}
                        className="text-[10px] truncate px-1.5 py-0.5 rounded bg-surface-100 text-surface-800 flex items-center gap-1 font-medium"
                      >
                        <span className="text-surface-500 font-mono text-[9px]">{formatTime(app.startTime)}</span>
                        <span className="truncate">{app.customerName}</span>
                      </div>
                    ))}
                    {dayApps.length > 2 && (
                      <div className="text-[9px] text-surface-400 font-medium pl-1">
                        +{dayApps.length - 2} więcej...
                      </div>
                    )}
                  </div>

                  <div className="pt-1 items-center justify-between text-[9px] text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex">
                    <span>Otwórz dzień</span>
                    <span>→</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ważne daty w bieżącym miesiącu (pod siatką kalendarza) */}
          {monthImportantEvents.length > 0 && (
            <div className="border-t border-surface-200 bg-surface-50/70 p-3 sm:p-4 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-bold text-surface-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-gold-600" />
                  Ważne daty w tym miesiącu ({monthImportantEvents.length}):
                </span>
                <span className="text-[11px] text-surface-500 hidden sm:inline">
                  Kliknij datę, aby przejść do widoku dnia
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {monthImportantEvents.map(ev => {
                  const visual = getAnnualEventVisuals(ev);
                  const dayLabel = ev.endDay && ev.endDay !== ev.day 
                    ? `${ev.day}.${String(ev.month).padStart(2, '0')} - ${ev.endDay}.${String(ev.endMonth || ev.month).padStart(2, '0')}`
                    : `${ev.day} ${POLISH_MONTHS_GENITIVE[ev.month - 1]}`;
                  
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        const targetDate = new Date(monthDate.getFullYear(), ev.month - 1, ev.day);
                        setExpandedClusterKey(null);
                        setCurrentDate(targetDate);
                        setView('schedule');
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium border shadow-xs transition hover:scale-[1.02] hover:shadow-sm active:scale-[0.98] cursor-pointer ${visual.badgeClass}`}
                      title={`Przejdź do ${dayLabel}`}
                    >
                      <span className="text-base leading-none">{visual.emoji}</span>
                      <span className="font-bold">{dayLabel}:</span>
                      <span className="truncate max-w-[160px] sm:max-w-[260px]">{ev.title}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60 ml-0.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-2xl shadow-sm border border-surface-200/60 overflow-hidden flex flex-col h-[75vh]">
          <div className="bg-surface-50 border-b border-surface-200 p-4 flex items-center justify-between z-20 shrink-0 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => changeDay(-1)} className="p-1.5 hover:bg-surface-200 rounded-lg text-surface-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div 
                className="w-48 text-center relative cursor-pointer group flex flex-col items-center justify-center"
                onClick={(e) => {
                  try {
                    const input = e.currentTarget.querySelector('input');
                    if (input && 'showPicker' in input) {
                      input.showPicker();
                    }
                  } catch (err) {}
                }}
              >
                <input 
                  type="date" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  value={`${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`}
                  onChange={(e) => {
                    if (e.target.value) {
                      setExpandedClusterKey(null);
                      setCurrentDate(new Date(e.target.value));
                    }
                  }}
                />
                <div className="font-serif text-lg text-surface-900 capitalize group-hover:text-gold-600 transition-colors flex items-center gap-1.5">
                  {currentDate.toLocaleDateString('pl-PL', { weekday: 'long' })}
                  <Calendar className="w-4 h-4 text-surface-300 group-hover:text-gold-500" />
                </div>
                <div className="text-xs text-surface-500">{currentDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
              <button onClick={() => changeDay(1)} className="p-1.5 hover:bg-surface-200 rounded-lg text-surface-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setExpandedClusterKey(null);
                  setCurrentDate(new Date());
                }}
                className="text-sm font-medium text-gold-600 hover:text-gold-700 bg-gold-50 hover:bg-gold-100 px-3 py-1.5 rounded-lg transition-colors border border-gold-200/50"
              >
                Dzisiaj
              </button>
            </div>
          </div>

          {/* Pasek Ważnych Dat w widoku dobowym */}
          {currentDayEvents.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 via-rose-50/40 to-amber-50 border-b border-amber-200 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 shrink-0 flex-wrap shadow-xs z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5 shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
                  {currentDate.toDateString() === new Date().toDateString() ? 'Ważna data dzisiaj:' : 'Ważna data w tym dniu:'}
                </span>
                {currentDayEvents.map(ev => {
                  const visual = getAnnualEventVisuals(ev);
                  return (
                    <div 
                      key={ev.id} 
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-semibold border shadow-xs ${visual.badgeClass}`}
                      title={ev.title}
                    >
                      <span className="text-sm sm:text-base">{visual.emoji}</span>
                      <span>{ev.title}</span>
                      <span className="text-[10px] font-normal opacity-70 ml-0.5">({visual.label})</span>
                    </div>
                  );
                })}
              </div>
              <button 
                onClick={() => navigate('/dashboard/annual-events')}
                className="text-xs text-amber-800 hover:text-amber-950 underline font-medium ml-auto hidden md:inline transition-colors cursor-pointer"
              >
                Wszystkie ważne daty →
              </button>
            </div>
          )}

          <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-surface-50/30 relative shadow-inner">
            <div className="h-full flex flex-col" style={{ minWidth: `max(100%, ${columns.length * 180 + 60}px)` }}>
              
              <div className="flex sticky top-0 z-20 bg-white border-b border-surface-200 shadow-sm">
                <div className="w-[60px] shrink-0 bg-surface-50 border-r border-surface-200"></div>
                {columns.map(col => (
                  <div key={col.id} className="flex-1 text-center py-3 border-r border-surface-200 font-medium text-surface-800 text-sm">
                    {col.name}
                  </div>
                ))}
              </div>

              <div className="relative">
                {timeSlots.map(time => {
                  const isToday = currentDate.toDateString() === new Date().toDateString();
                  const nowHour = new Date().getHours();
                  const slotHour = parseInt(time.split(':')[0], 10);
                  const isCurrentHour = isToday && (slotHour === nowHour);

                  const slotH = slotHeights[time] || 48;
                  const isThisSlotExpanded = activeExpandedCluster && activeExpandedCluster.slotKey === time;

                  return (
                    <div 
                      key={time} 
                      style={{ height: `${slotH}px` }}
                      className={`flex border-b border-surface-100 relative transition-[height] duration-300 ease-in-out ${
                        isCurrentHour ? 'ring-2 ring-inset ring-gold-400/80 bg-gold-50/20 z-10' : ''
                      }`}
                    >
                      <div 
                        style={{ height: `${slotH}px` }}
                        className={`w-[60px] shrink-0 text-right pr-2 pt-1 border-r border-surface-200 transition-[height] duration-300 ease-in-out flex flex-col justify-between pb-1 ${
                          isCurrentHour ? 'bg-gold-100/70 text-gold-950 font-bold border-r-gold-300' : 'bg-surface-50/50'
                        }`}
                      >
                        <span className={`text-[13px] sm:text-sm ${isCurrentHour ? 'font-bold text-gold-800' : 'font-semibold text-surface-500'}`}>
                          {time}
                        </span>
                        {isThisSlotExpanded && (
                          <span className="text-[9px] font-bold text-gold-600 uppercase tracking-tighter self-end animate-pulse">
                            Rozwinięte
                          </span>
                        )}
                      </div>
                      {columns.map(col => {
                        const isWorking = isWorkingHour(col, time);
                        const zone = businessProfile === 'personal' ? getSlotZone(time, currentDate) : null;
                        
                        let zoneStyle = '';
                        let zoneBadge = '';
                        if (businessProfile === 'personal') {
                          if (zone === 'work') {
                            zoneStyle = 'bg-blue-50/80 border-r border-b border-blue-100/90 hover:bg-blue-100/70';
                            zoneBadge = 'Praca';
                          } else if (zone === 'private') {
                            zoneStyle = 'bg-emerald-50/80 border-r border-b border-emerald-100/90 hover:bg-emerald-100/70';
                            zoneBadge = 'Strefa Prywatna';
                          } else if (zone === 'focus') {
                            zoneStyle = 'bg-rose-50/80 border-r border-b border-rose-100/90 hover:bg-rose-100/70';
                            zoneBadge = 'Czas Skupienia';
                          } else {
                            zoneStyle = 'bg-surface-200/70 border-r border-b border-surface-300/80 hover:bg-surface-200/90';
                            zoneBadge = 'Poza godzinami';
                          }
                        } else {
                          zoneStyle = isWorking 
                            ? 'hover:bg-gold-50/20 cursor-pointer bg-transparent border-r border-surface-100' 
                            : 'bg-surface-100 cursor-not-allowed border-r border-surface-100';
                        }

                        return (
                          <div 
                            key={col.id} 
                            style={{ height: `${slotH}px` }}
                            className={`flex-1 transition-colors group relative cursor-pointer ${zoneStyle}`}
                            onClick={() => {
                              openAddModal(time, col.id === 'solo' ? undefined : col.id);
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-between px-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                              {businessProfile === 'personal' && (
                                <span className="text-[10px] font-semibold opacity-75 uppercase tracking-wider">
                                  {zoneBadge}
                                </span>
                              )}
                              <Plus className="w-3.5 h-3.5 text-surface-400 ml-auto" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div className="absolute inset-0 flex pointer-events-none">
                  <div className="w-[60px] shrink-0"></div>
                  {columns.map(col => {
                    const clusters = allClustersByCol[col.id] || [];

                    return (
                      <div key={`events-${col.id}`} className="flex-1 relative pointer-events-none">
                        {clusters.map(cluster => {
                          if (cluster.appointments.length === 1) {
                            // Pojedyncze wydarzenie - renderowane standardowo
                            const app = cluster.appointments[0];
                            const start = new Date(app.startTime);
                            const end = new Date(app.endTime);
                            const slotKey = getSlotKeyFromDate(start);
                            const startMin = start.getMinutes() % 30;
                            const baseTop = getTopPxForSlot(slotKey);
                            const curSlotH = slotHeights[slotKey] || 48;
                            const topPx = baseTop + (startMin / 30) * (curSlotH > 48 ? 48 : curSlotH);

                            const endSlotKey = getSlotKeyFromDate(end);
                            const endMin = end.getMinutes() % 30;
                            const baseEndTop = getTopPxForSlot(endSlotKey) + (endMin / 30) * 48;
                            const heightPx = Math.max(28, baseEndTop - topPx);

                            let bgColor = getColorCode(app.service?.id || '');
                            if (businessProfile === 'personal') {
                              const appZone = getSlotZone(formatTime(app.startTime), new Date(app.startTime));
                              if (appZone === 'private' || app.contactLevel === 'CALL') {
                                bgColor = 'bg-emerald-700 border-emerald-900';
                              } else if (appZone === 'focus') {
                                bgColor = 'bg-rose-700 border-rose-900';
                              } else if (appZone === 'off') {
                                bgColor = 'bg-surface-700 border-surface-800';
                              } else {
                                bgColor = 'bg-blue-700 border-blue-900';
                              }
                            }

                            const isConfirmedByClient = app.status === 'confirmed_by_client';
                            const hasPromo = !!app.promoCode;

                            return (
                              <div 
                                key={app.id} 
                                onClick={(e) => { e.stopPropagation(); openEditModal(app); }}
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                className={`absolute left-1 right-2 z-10 pointer-events-auto ${bgColor} text-white p-2 rounded-xl shadow-md flex flex-col overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer ${isConfirmedByClient ? 'ring-2 ring-green-400 border-2 border-green-500' : 'border border-transparent'}`}
                              >
                                <span className="font-semibold text-sm truncate drop-shadow-sm flex items-center gap-1">
                                  {app.isProcessed ? (
                                    <span className="text-emerald-300 font-bold text-sm" title="Załatwione">✓</span>
                                  ) : (
                                    <span className="text-amber-300 font-bold text-sm" title="Do załatwienia">•</span>
                                  )}
                                  {app.customerName}
                                  {hasPromo && <Gift className="w-3.5 h-3.5 text-yellow-300 ml-1" title="Z kodem rabatowym" />}
                                  {app.npsScore && <span className="ml-1 flex items-center text-xs text-yellow-300" title="Ocena NPS"><Star className="w-3 h-3 mr-0.5"/>{app.npsScore}</span>}
                                </span>
                                <span className="text-xs sm:text-[13px] opacity-90 truncate font-medium">{app.callSummary || app.service?.name}</span>
                              </div>
                            );
                          }

                          // WIELE WYDARZEŃ W OKNIE 30 MIN (KLASTER)
                          const isExpanded = expandedClusterKey === cluster.id;
                          const topPx = getTopPxForSlot(cluster.slotKey);
                          const slotH = slotHeights[cluster.slotKey] || 48;

                          if (!isExpanded) {
                            // Zbiorowy kafelek zwinięty
                            const unprocessedCount = cluster.appointments.filter(a => !a.isProcessed).length;

                            return (
                              <div 
                                key={cluster.id} 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setExpandedClusterKey(cluster.id); 
                                }}
                                style={{ top: `${topPx + 2}px`, height: '44px' }}
                                className="absolute left-1 right-2 z-10 pointer-events-auto bg-gradient-to-r from-surface-900 via-surface-800 to-surface-900 text-white px-2.5 py-1.5 rounded-xl shadow-md hover:shadow-lg border-2 border-gold-400/90 hover:border-gold-300 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] group"
                                title="Kliknij, aby rozwinąć wszystkie wydarzenia w tym czasie"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="bg-gold-500/20 text-gold-300 border border-gold-400/40 text-xs sm:text-sm font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                    <Layers className="w-3.5 h-3.5 text-gold-400" />
                                    <span>{cluster.appointments.length} {cluster.appointments.length < 5 ? 'wydarzenia' : 'wydarzeń'}</span>
                                  </span>

                                  {/* Na mobile ukryte - zostaje tylko ilość i Rozwiń */}
                                  <span className="text-xs font-medium text-surface-200 truncate hidden sm:inline">
                                    {cluster.appointments.map(a => a.customerName).filter(Boolean).join(', ')}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {unprocessedCount > 0 ? (
                                    <span className="hidden sm:flex text-amber-300 font-bold text-xs items-center gap-0.5 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px]" title="Wymaga załatwienia">
                                      • {unprocessedCount} do załatwienia
                                    </span>
                                  ) : (
                                    <span className="hidden sm:flex text-emerald-400 text-xs items-center gap-0.5 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px]" title="Wszystkie załatwione">
                                      ✓ Załatwione
                                    </span>
                                  )}

                                  <span className="text-xs sm:text-sm font-bold text-gold-300 bg-surface-800/90 group-hover:bg-gold-500 group-hover:text-surface-950 px-2.5 py-1 rounded-md transition-colors flex items-center gap-0.5 shrink-0 border border-gold-500/30">
                                    Rozwiń ▾
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          // Zbiorowy kafelek rozwinięty (pole 30 min fizycznie powiększone w siatce)
                          return (
                            <div 
                              key={cluster.id} 
                              style={{ top: `${topPx + 2}px`, height: `${slotH - 4}px` }}
                              className="absolute left-1 right-2 z-30 pointer-events-auto bg-surface-900 text-white p-2.5 rounded-2xl shadow-2xl border-2 border-gold-400 flex flex-col justify-between overflow-hidden transition-all animate-in fade-in duration-200"
                            >
                              {/* Nagłówek klastra */}
                              <div className="flex items-center justify-between pb-2 border-b border-surface-700/80 shrink-0">
                                <div className="flex items-center gap-2">
                                  <span className="bg-gold-500/25 text-gold-300 border border-gold-400/50 text-xs sm:text-sm font-bold px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-gold-400" />
                                    <span>{cluster.appointments.length} {cluster.appointments.length < 5 ? 'wydarzenia' : 'wydarzeń'} w tym czasie</span>
                                  </span>
                                  <span className="text-xs text-surface-400 font-mono hidden sm:inline">
                                    ({formatTime(cluster.earliestStart.toISOString())} - {formatTime(cluster.latestEnd.toISOString())})
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedClusterKey(null);
                                  }}
                                  className="text-xs sm:text-sm font-semibold text-gold-300 hover:text-white bg-surface-800 hover:bg-surface-700 px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-surface-600 shadow-xs"
                                  title="Zwiń ten przedział czasu"
                                >
                                  <span>Zwiń</span>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Lista osobnych kafelków dla każdego wydarzenia */}
                              <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-0.5 my-0.5">
                                {cluster.appointments.map(app => {
                                  let bgColor = getColorCode(app.service?.id || '');
                                  if (businessProfile === 'personal') {
                                    const appZone = getSlotZone(formatTime(app.startTime), new Date(app.startTime));
                                    if (appZone === 'private' || app.contactLevel === 'CALL') {
                                      bgColor = 'bg-emerald-700 border-emerald-800 hover:bg-emerald-600';
                                    } else if (appZone === 'focus') {
                                      bgColor = 'bg-rose-700 border-rose-800 hover:bg-rose-600';
                                    } else if (appZone === 'off') {
                                      bgColor = 'bg-surface-700 border-surface-800 hover:bg-surface-600';
                                    } else {
                                      bgColor = 'bg-blue-700 border-blue-900 hover:bg-blue-600';
                                    }
                                  }

                                  const isConfirmedByClient = app.status === 'confirmed_by_client';
                                  const hasPromo = !!app.promoCode;

                                  return (
                                    <div
                                      key={app.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditModal(app);
                                      }}
                                      className={`${bgColor} text-white p-2.5 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between hover:scale-[1.005]`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 truncate">
                                          {app.isProcessed ? (
                                            <span className="text-emerald-300 font-bold text-sm" title="Załatwione">✓</span>
                                          ) : (
                                            <span className="text-amber-300 font-bold text-sm" title="Do załatwienia">•</span>
                                          )}
                                          <span className="font-semibold text-sm sm:text-base truncate drop-shadow-sm">
                                            {app.customerName}
                                          </span>
                                          {hasPromo && <Gift className="w-3.5 h-3.5 text-yellow-300 shrink-0" title="Z kodem rabatowym" />}
                                          {app.npsScore && <span className="flex items-center text-xs text-yellow-300 shrink-0"><Star className="w-3 h-3 mr-0.5"/>{app.npsScore}</span>}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-xs text-surface-200 font-mono bg-black/30 px-1.5 py-0.5 rounded">
                                            {formatTime(app.startTime)} - {formatTime(app.endTime)}
                                          </span>
                                          {app.contactLevel === 'CALL' && (
                                            <span className="text-[11px] font-bold bg-blue-500/40 text-blue-100 border border-blue-400/30 px-1.5 py-0.5 rounded">
                                              📞 Tel
                                            </span>
                                          )}
                                          {app.contactLevel === 'TASK' && (
                                            <span className="text-[11px] font-bold bg-amber-500/40 text-amber-100 border border-amber-400/30 px-1.5 py-0.5 rounded">
                                              📌 Zadanie
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Treść podsumowania i czas rozmowy */}
                                      <div className="text-xs sm:text-[13px] text-surface-200/90 truncate mt-1.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2 truncate">
                                          {app.callDuration !== undefined && app.callDuration !== null && app.callDuration > 0 && (
                                            <span className="text-[11px] bg-black/25 px-1.5 py-0.5 rounded text-surface-300 shrink-0">
                                              📞 {app.callDuration < 60 ? `${app.callDuration}s` : `${Math.floor(app.callDuration / 60)}m ${app.callDuration % 60}s`}
                                            </span>
                                          )}
                                          <span className="truncate">{app.callSummary || app.notes || app.service?.name || 'Brak opisu'}</span>
                                        </div>
                                        <span className="text-xs text-gold-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                          Szczegóły →
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Stopka klastra */}
                              <div className="pt-1.5 border-t border-surface-700/60 flex items-center justify-between text-xs text-surface-400 shrink-0">
                                <span>Dotknij kafelka, aby otworzyć szczegóły</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedClusterKey(null);
                                  }}
                                  className="text-gold-400 hover:text-gold-300 font-medium cursor-pointer flex items-center gap-1"
                                >
                                  <span>Zwiń widok</span>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>

          {/* Legenda stref dla pakietu osobistego */}
          {businessProfile === 'personal' && (
            <div className="bg-white border-t border-surface-200 p-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-xs">
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="font-bold text-surface-600 text-[10px] uppercase tracking-wider">Strefy:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-blue-100 border border-blue-300"></span>
                  <span className="text-surface-700 font-medium text-[11px]">Praca (Dla wszystkich)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-300"></span>
                  <span className="text-surface-700 font-medium text-[11px]">Strefa Prywatna (Tylko VIP & Rodzina)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-rose-100 border border-rose-300"></span>
                  <span className="text-surface-700 font-medium text-[11px]">Czas Skupienia / Lekcji (Blokada)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-surface-300 border border-surface-400"></span>
                  <span className="text-surface-600 text-[11px]">Czas wolny / Noc</span>
                </div>
              </div>
              {isDateHolidayOrVacation(currentDate) && (
                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1">
                  🏖️ Dziś: Wolne / Święto (reguła Niedzieli)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {selectedAppt &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-surface-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedAppt(null);
            }}
          >
            <div className="glass-card bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 relative group w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gold-50 p-2.5 rounded-xl text-gold-600 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl text-surface-900 leading-tight">
                  {selectedAppt.id === 'new' 
                    ? (businessProfile === 'personal' ? 'Nowe Wydarzenie' : 'Nowa Rezerwacja') 
                    : (businessProfile === 'personal' ? 'Szczegóły Wydarzenia' : 'Szczegóły Rezerwacji')}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAppt(null)}
                className="p-1.5 text-surface-400 hover:text-surface-900 hover:bg-surface-100 rounded-lg transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
                title="Zamknij"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {businessProfile !== 'personal' && (
              <div className="mb-6 -mt-2">
                <p className="text-xs font-medium text-surface-500 mb-2 uppercase tracking-wider">Marketing AI</p>
                <div className="flex flex-wrap gap-2">
                  {selectedAppt.id === 'new' ? (
                    <>
                      <button type="button" onClick={() => navigate('/dashboard/simulator', { state: { initialPrompt: "Uruchom kampanię Last Minute na datę " + ((formData.date ? formData.date + ' ' + formData.startTime : selectedAppt.startTime)) } })} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">🚀 Oferta Last Minute</button>
                      <button type="button" onClick={() => navigate('/dashboard/simulator', { state: { initialPrompt: "Stwórz kampanię informacyjną z tagiem #uśpieni celującą w termin " + ((formData.date ? formData.date + ' ' + formData.startTime : selectedAppt.startTime)) } })} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">♻️ Wybudź klientów</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => navigate('/dashboard/simulator', { state: { initialPrompt: "Wyślij prośbę o potwierdzenie rezerwacji do klienta " + formData.customerPhone + " na datę " + ((formData.date ? formData.date + ' ' + formData.startTime : selectedAppt.startTime)) } })} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">🗓 Potwierdź rezerwacje</button>
                      <button type="button" onClick={() => navigate('/dashboard/simulator', { state: { initialPrompt: "Wyślij ankietę NPS do klienta " + formData.customerPhone } })} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">⭐️ Badanie zadowolenia klienta</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {!isEditing && selectedAppt.id !== 'new' ? (
              <div className="space-y-4">
                {(selectedAppt.status === 'confirmed_by_client' || selectedAppt.promoCode) && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200 space-y-2 mb-4">
                    {selectedAppt.status === 'confirmed_by_client' && (
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Potwierdzone przez klienta (SMS/Głos)
                      </div>
                    )}
                    {selectedAppt.npsScore && (
                      <div className="flex items-center gap-2 text-yellow-700 font-medium">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        Ocena klienta: {selectedAppt.npsScore} / 5
                      </div>
                    )}
                    {selectedAppt.promoCode && (
                      <div className="flex items-center gap-2 text-amber-700 font-medium">
                        <Gift className="w-5 h-5 text-amber-600" />
                        Użyty rabat: {selectedAppt.promoCode}
                      </div>
                    )}
                  </div>
                )}
                {/* Checkbox i Status: Czy załatwione */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 bg-white shadow-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={selectedAppt.isProcessed || false} 
                      onChange={() => handleToggleProcessed(selectedAppt.id, selectedAppt.isProcessed || false)}
                      className="w-4 h-4 rounded text-primary border-surface-300 focus:ring-primary cursor-pointer accent-gold-500"
                    />
                    <span className="text-sm font-semibold text-surface-900">
                      Czy załatwione
                    </span>
                  </label>
                  {selectedAppt.isProcessed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Załatwione
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      • Do załatwienia
                    </span>
                  )}
                </div>

                <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 space-y-3">
                  <div className="flex items-center gap-3 text-surface-800">
                    <User className="w-4 h-4 text-surface-400" />
                    <span className="font-medium">{selectedAppt.customerName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-surface-600">
                    <Phone className="w-4 h-4 text-surface-400" />
                    <span className="text-sm">{selectedAppt.customerPhone}</span>
                  </div>
                  {selectedAppt.callDuration !== undefined && selectedAppt.callDuration !== null && selectedAppt.callDuration > 0 && (
                    <div className="flex items-center gap-3 text-surface-600">
                      <PhoneCall className="w-4 h-4 text-surface-400" />
                      <span className="text-sm">
                        Czas trwania połączenia: {selectedAppt.callDuration < 60 ? `${selectedAppt.callDuration} sek.` : `${Math.floor(selectedAppt.callDuration / 60)} min ${selectedAppt.callDuration % 60} sek.`}
                      </span>
                    </div>
                  )}
                  {selectedAppt.service && (
                    <div className="flex items-center gap-3 text-surface-600">
                      <Tag className="w-4 h-4 text-surface-400" />
                      <span className="text-sm">{selectedAppt.service.name}</span>
                    </div>
                  )}
                  {selectedAppt.staff && (
                    <div className="flex items-center gap-3 text-surface-600">
                      <User className="w-4 h-4 text-surface-400" />
                      <span className="text-sm">{selectedAppt.staff.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-surface-600">
                    <Clock className="w-4 h-4 text-surface-400" />
                    <span className="text-sm">
                      {formatDate(selectedAppt.startTime)}, {formatTime(selectedAppt.startTime)} - {formatTime(selectedAppt.endTime)}
                    </span>
                  </div>
                </div>

                {/* Podsumowanie rozmowy / Wiadomość */}
                {(selectedAppt.callSummary || selectedAppt.notes) && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-surface-500 uppercase tracking-wider">Podsumowanie rozmowy / Wiadomość</div>
                    <div className="text-sm text-surface-800 leading-relaxed bg-surface-50 p-3.5 rounded-xl border border-surface-100 whitespace-pre-wrap">
                      {selectedAppt.callSummary || selectedAppt.notes}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedAppt.callSummary || selectedAppt.notes || '', selectedAppt.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium rounded-xl text-xs transition cursor-pointer"
                        title="Kopiuj treść do schowka"
                      >
                        {copiedId === selectedAppt.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === selectedAppt.id ? 'Skopiowano!' : 'Kopiuj'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShare(`Wydarzenie: ${selectedAppt.customerName}`, `${selectedAppt.customerName} (${selectedAppt.customerPhone}):\n${selectedAppt.callSummary || selectedAppt.notes || ''}\n${selectedAppt.actionItems ? 'Zalecane działanie: ' + selectedAppt.actionItems : ''}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold-50 hover:bg-gold-100 text-gold-900 border border-gold-200/60 font-medium rounded-xl text-xs transition cursor-pointer"
                        title="Udostępnij przez WhatsApp, Wiadomości lub Notatki"
                      >
                        <Share2 className="w-3.5 h-3.5 text-gold-700" />
                        Udostępnij
                      </button>
                    </div>
                  </div>
                )}

                {/* Zalecane działanie */}
                {selectedAppt.actionItems && (
                  <div className="text-xs text-primary font-semibold flex items-center gap-1.5 bg-primary/5 p-2.5 rounded-xl border border-primary/10">
                    <span>🎯 Zalecane działanie:</span>
                    <span>{selectedAppt.actionItems}</span>
                  </div>
                )}

                {/* Przycisk Oddzwoń */}
                {selectedAppt.customerPhone && selectedAppt.customerPhone !== 'nieznany' && (
                  <a
                    href={`tel:${selectedAppt.customerPhone.replace(/\s/g, '')}`}
                    className="flex items-center justify-center gap-2 w-full bg-surface-900 hover:bg-surface-800 text-white py-2.5 rounded-xl font-medium text-sm transition-colors text-center shadow-xs cursor-pointer"
                  >
                    <Phone className="w-4 h-4" /> Oddzwoń ({selectedAppt.customerPhone})
                  </a>
                )}
                
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-surface-100 text-surface-900 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-surface-200 transition-colors"
                  >
                    Edytuj
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {businessProfile === 'personal' && (
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">Forma / Typ wydarzenia</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'MEETING', label: '🤝 Spotkanie', desc: '45-60 min' },
                        { id: 'CALL', label: '📞 Telefon', desc: '10-15 min' },
                        { id: 'TASK', label: '📌 Zadanie', desc: 'Do zrobienia' }
                      ].map(lvl => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => handleContactLevelChange(lvl.id)}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${formData.contactLevel === lvl.id ? 'border-primary bg-gold-50/50 text-surface-900 font-bold shadow-xs' : 'border-surface-200 text-surface-600 bg-white hover:border-surface-300'}`}
                        >
                          <div>{lvl.label}</div>
                          <div className="text-[10px] text-surface-400 font-normal">{lvl.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">
                    {businessProfile === 'personal' ? 'Tytuł spotkania / Osoba' : 'Imię klienta'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.customerName}
                    onChange={e => setFormData({...formData, customerName: e.target.value})}
                    placeholder={businessProfile === 'personal' ? 'np. Rozmowa ws. projektu z Markiem' : 'np. Anna Kowalska'}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-xs font-medium text-surface-500">Telefon</label>
                    {selectedAppt.callerPhone && (
                        <div className="group/tooltip outline-none" tabIndex={0}>
                          <div className="w-5 h-5 rounded-full bg-gold-100 text-gold-600 flex items-center justify-center text-xs font-bold cursor-pointer border border-gold-300">
                            i
                          </div>
                          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 p-5 bg-[#36454F] text-white text-base rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible transition-all z-[100] text-center shadow-2xl border border-surface-600">
                            <p className="text-sm text-surface-200 mb-1">Rezerwacji dokonano z numeru:</p>
                            <p className="font-bold text-xl mb-3 tracking-wide">{selectedAppt.callerPhone}</p>
                            <a 
                              href={`tel:${selectedAppt.callerPhone.replace(/\s/g, '')}`} 
                              className="flex items-center justify-center gap-2 w-full bg-gold-500 hover:bg-gold-600 text-white py-2.5 rounded-lg font-medium text-sm transition-colors text-center shadow-lg"
                            >
                              📞 Zadzwoń
                            </a>
                          </div>
                        </div>
                      )}
                  </div>
                  <input 
                    type="text" 
                    value={formData.customerPhone}
                    onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                </div>
                {businessProfile !== 'personal' && (
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Usługa</label>
                    <select 
                      value={formData.serviceId}
                      onChange={e => setFormData({...formData, serviceId: e.target.value})}
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    >
                      {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>)}
                    </select>
                  </div>
                )}
                {staffList.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Osoba / Zasób</label>
                    <select 
                      value={formData.staffId}
                      onChange={e => setFormData({...formData, staffId: e.target.value})}
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    >
                      <option value="">Wybierz osobę / zasób</option>
                      {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Od</label>
                    <input 
                      type="datetime-local" 
                      value={formData.startTime}
                      onChange={e => setFormData({...formData, startTime: e.target.value})}
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Do</label>
                    <input 
                      type="datetime-local" 
                      value={formData.endTime}
                      onChange={e => setFormData({...formData, endTime: e.target.value})}
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    />
                  </div>
                </div>
                <div className="pt-2 flex gap-2">
                  <button 
                    onClick={handleSave}
                    className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-surface-800 hover:text-white transition-colors"
                  >
                    Zapisz
                  </button>
                  {selectedAppt.id !== 'new' && (
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-surface-100 text-surface-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-surface-200 transition-colors"
                    >
                      Anuluj
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
