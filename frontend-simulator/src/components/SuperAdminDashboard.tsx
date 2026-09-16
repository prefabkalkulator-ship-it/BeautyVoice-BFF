import React, { useState, useEffect } from 'react';
import { requestForToken } from '../firebase';

export function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [betaApplications, setBetaApplications] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Stan logowania 2FA
  const [authStep, setAuthStep] = useState<'PIN' | '2FA'>('PIN');
  const [authPin, setAuthPin] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('+48 531 *** 626');
  const [countdown, setCountdown] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Statystyki platformy
  const [stats, setStats] = useState<any>({
    totalTenants: 0,
    highRiskTenants: 0,
    suspendedTenants: 0,
    pendingBeta: 0,
    totalMinutesUsed: 0,
    totalMinutesIncluded: 0,
    totalAppts: 0,
    totalCalls: 0
  });

  // Filtrowanie i sortowanie
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HIGH_RISK' | 'SUSPENDED' | 'ACTIVE' | 'BETA_PENDING'>('ALL');
  const [sortBy, setSortBy] = useState('riskDesc');
  const [activeTab, setActiveTab] = useState<'tenants' | 'beta'>('tenants');

  // Urządzenia mobilne
  const [showListOnMobile, setShowListOnMobile] = useState(true);

  // Stan PWA push
  const [pushStatus, setPushStatus] = useState<string>('');
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  // Formularz zatwierdzania Beta
  const [approvingTenantId, setApprovingTenantId] = useState<string | null>(null);
  const [assignedNumberInput, setAssignedNumberInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [minutesInput, setMinutesInput] = useState(300);
  const [isApproving, setIsApproving] = useState(false);

  // Stan usuwania wniosku beta
  const [deletingApp, setDeletingApp] = useState<any | null>(null);
  const [deleteEntireAccount, setDeleteEntireAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Stan usuwania konta tenanta
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null);
  const [deleteTenantConfirmText, setDeleteTenantConfirmText] = useState('');
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);

  // Stan audytu AI na żądanie
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenants();
      fetchBetaApplications();
      fetchStats();
    }
  }, [isAuthenticated]);

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
      'Authorization': `Bearer ${token || ''}`
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('adminToken');
      setIsAuthenticated(false);
      alert('Sesja SuperAdmina wygasła lub brak uprawnień. Zaloguj się ponownie.');
    }
    return res;
  };

  // Zegary dla procedury 2FA
  useEffect(() => {
    let timer: any;
    if (authStep === '2FA' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [authStep, countdown]);

  useEffect(() => {
    let cooldownTimer: any;
    if (authStep === '2FA' && resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(cooldownTimer);
  }, [authStep, resendCooldown]);

  // Krok 1: Weryfikacja PIN i zlecenie wysyłki SMS
  const handleInitiateLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authPin.trim()) return;
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authPin.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nieprawidłowy kod PIN');
      }
      setChallengeId(data.challengeId);
      setMaskedPhone(data.maskedPhone || '+48 531 *** 626');
      setCountdown(data.expiresInSeconds || 300);
      setResendCooldown(30);
      setSmsCode('');
      setAuthStep('2FA');
    } catch (err: any) {
      setLoginError(err.message || 'Błąd logowania');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Krok 2: Weryfikacja 6-cyfrowego kodu SMS
  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!smsCode.trim() || !challengeId) return;
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          code: smsCode.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nieprawidłowy kod weryfikacyjny');
      }
      localStorage.setItem('adminToken', data.token);
      setIsAuthenticated(true);
      setAuthPin('');
      setSmsCode('');
      setChallengeId('');
      setAuthStep('PIN');
    } catch (err: any) {
      setLoginError(err.message || 'Błąd autoryzacji');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Ponowna wysyłka kodu SMS
  const handleResendCode = async () => {
    if (resendCooldown > 0 || !challengeId || !authPin) return;
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, pin: authPin.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się wysłać kodu ponownie');
      }
      setCountdown(data.expiresInSeconds || 300);
      setResendCooldown(30);
      setSmsCode('');
      alert('Nowy kod weryfikacyjny SMS został wysłany!');
    } catch (err: any) {
      setLoginError(err.message || 'Błąd ponownej wysyłki');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBackToPin = () => {
    setAuthStep('PIN');
    setSmsCode('');
    setLoginError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setAuthStep('PIN');
    setAuthPin('');
    setSmsCode('');
  };

  const fetchStats = async () => {
    try {
      const res = await adminFetch('/api/admin/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error('Błąd pobierania statystyk:', e);
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await adminFetch('/api/admin/tenants');
      if (res.ok) {
        setTenants(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBetaApplications = async () => {
    try {
      const res = await adminFetch('/api/admin/beta-applications');
      if (res.ok) {
        setBetaApplications(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTenantDetails = async (id: string) => {
    try {
      const res = await adminFetch(`/api/admin/tenants/${id}`);
      if (res.ok) {
        setSelectedTenant(await res.json());
        setShowListOnMobile(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    try {
      const token = await requestForToken();
      if (!token) {
        alert('Przeglądarka zablokowała powiadomienia lub brak wsparcia FCM. Sprawdź uprawnienia w ustawieniach strony.');
        setIsEnablingPush(false);
        return;
      }
      const res = await adminFetch('/api/admin/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          label: 'SuperAdmin Phone PWA (' + new Date().toLocaleDateString() + ')'
        })
      });
      if (res.ok) {
        setPushStatus('✅ Powiadomienia aktywne');
        alert('🔔 Powiadomienia PWA włączone! Będziesz otrzymywać natychmiastowe alerty o naruszeniach TOS oraz nowych wnioskach firm.');
      } else {
        alert('Błąd rejestracji tokena na serwerze.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Błąd podczas włączania powiadomień: ' + err.message);
    } finally {
      setIsEnablingPush(false);
    }
  };

  // Uruchomienie Audytu AI
  const handleAuditTenant = async (tenantId: string) => {
    setIsAuditing(true);
    try {
      const res = await adminFetch(`/api/admin/tenants/${tenantId}/audit`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`🔍 Wynik Audytu AI:\nStatus: ${data.riskLevel}\n${data.reason || 'Brak uwag - profil bezpieczny'}`);
        await fetchTenants();
        await fetchStats();
        await fetchTenantDetails(tenantId);
      } else {
        alert(`Błąd audytu: ${data.error || res.statusText}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia: ${e.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  // Usunięcie pojedynczego wpisu FAQ przez Admina
  const handleDeleteFaq = async (tenantId: string, faqId: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten wpis z bazy wiedzy firmy? Po usunięciu system automatycznie przeliczy audyt moderacji.')) return;
    try {
      const res = await adminFetch(`/api/admin/tenants/${tenantId}/faq/${faqId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert('✅ Wpis FAQ został usunięty z bazy wiedzy.');
        await fetchTenantDetails(tenantId);
        await fetchTenants();
        await fetchStats();
      } else {
        alert(`Błąd: ${data.error || res.statusText}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia: ${e.message}`);
    }
  };

  // Usunięcie całego konta tenanta
  const handleConfirmDeleteTenant = async () => {
    if (!deletingTenant) return;
    setIsDeletingTenant(true);
    try {
      const res = await adminFetch(`/api/admin/tenants/${deletingTenant.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Konto firmy "${deletingTenant.name}" zostało trwale usunięte.`);
        setDeletingTenant(null);
        if (selectedTenant?.id === deletingTenant.id) {
          setSelectedTenant(null);
        }
        await fetchTenants();
        await fetchStats();
        await fetchBetaApplications();
      } else {
        alert(`Błąd: ${data.error || res.statusText}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia: ${e.message}`);
    } finally {
      setIsDeletingTenant(false);
    }
  };

  // Standardowe akcje tenanta
  const handleAction = async (id: string, action: string, payload: any = {}) => {
    const actionLabels: Record<string, string> = {
      approve: 'Zatwierdź profil jako bezpieczny (LOW RISK)',
      suspend: payload.suspend ? 'Zawieś całe konto (blokada AI i połączeń)' : 'Odblokuj konto użytkownika',
      'adjust-minutes': `Zmień minuty (${payload.additionalMinutes > 0 ? '+' : ''}${payload.additionalMinutes} min)`,
      sms: 'Wyślij wiadomość SMS',
      'subscription/status': payload.status === 'active' ? 'Wznów subskrypcję' : 'Zawieś subskrypcję na 30 dni'
    };
    const confirmPrompt = actionLabels[action] || action;
    if (!window.confirm(`Czy na pewno chcesz wykonać operację: "${confirmPrompt}"?`)) return;
    try {
      const res = await adminFetch(`/api/admin/tenants/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Błąd: ${err.error || res.statusText}`);
      }
      await fetchTenants();
      await fetchStats();
      await fetchBetaApplications();
      if (selectedTenant && selectedTenant.id === id) {
        await fetchTenantDetails(id);
      }
    } catch (e) {
      console.error(e);
      alert('Błąd połączenia z serwerem');
    }
  };

  // Zatwierdzenie pilotażu Beta
  const openApproveModal = (tenant: any) => {
    setApprovingTenantId(tenant.id);
    setAssignedNumberInput(tenant.assignedPhoneNumber || '+48');
    setPinInput(tenant.pinCode || Math.floor(1000 + Math.random() * 9000).toString());
    setMinutesInput(300);
  };

  const submitApproveBeta = async (tenantId: string) => {
    if (!assignedNumberInput || assignedNumberInput.trim().length < 9) {
      alert('Wprowadź prawidłowy wirtualny numer telefonu zakupiony w Zadarma (np. +48459568507)');
      return;
    }
    if (!window.confirm(`Czy na pewno chcesz aktywować pakiet Premium dla firmy i przypisać numer ${assignedNumberInput}? Klient otrzyma powiadomienie SMS o aktywacji.`)) {
      return;
    }

    setIsApproving(true);
    try {
      const res = await adminFetch(`/api/admin/beta-applications/${tenantId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedPhoneNumber: assignedNumberInput.trim(),
          pinCode: pinInput.trim(),
          minutesIncluded: minutesInput
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Błąd aktywacji: ${data.error || res.statusText}`);
        return;
      }

      alert(`🎉 Sukces! Konto firmy aktywowane.\nPrzypisany numer: ${data.assignedPhoneNumber}\nPIN: ${data.pinCode}\nSMS wysłany: ${data.smsSent ? 'TAK' : 'NIE'}`);
      setApprovingTenantId(null);
      await fetchBetaApplications();
      await fetchTenants();
      await fetchStats();
      if (selectedTenant && selectedTenant.id === tenantId) {
        await fetchTenantDetails(tenantId);
      }
    } catch (err: any) {
      alert('Błąd połączenia: ' + err.message);
    } finally {
      setIsApproving(false);
    }
  };

  // Kasowanie wniosku pilotażowego
  const openDeleteModal = (app: any) => {
    setDeletingApp(app);
    setDeleteEntireAccount(false);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingApp) return;
    setIsDeleting(true);
    try {
      const res = await adminFetch(`/api/admin/beta-applications/${deletingApp.id}?deleteAccount=${deleteEntireAccount}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Błąd usuwania wniosku: ${data.error || res.statusText}`);
        return;
      }
      alert(`✅ ${data.message || 'Wniosek został pomyślnie usunięty.'}`);
      setDeletingApp(null);
      await fetchBetaApplications();
      await fetchTenants();
      await fetchStats();
      if (selectedTenant && selectedTenant.id === deletingApp.id) {
        setSelectedTenant(null);
      }
    } catch (err: any) {
      alert(`Błąd połączenia: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Ekran logowania dwuetapowego (2FA)
  if (!isAuthenticated) {
    const formatTime = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-sans">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl w-full max-w-md text-center relative overflow-hidden">
          {/* Ozdobny pasek statusu na górze */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

          {authStep === 'PIN' ? (
            /* KROK 1: WPROWADZENIE KODU PIN */
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold mb-4 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                Krok 1 z 2: Tożsamość
              </div>

              <div className="w-16 h-16 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
                🛡️
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-1">Super Admin EVA</h2>
              <p className="text-xs text-gray-400 mb-6">Wprowadź kod PIN administratora platformy</p>

              {loginError && (
                <div className="mb-4 p-3 bg-red-950/60 text-red-400 rounded-xl text-xs border border-red-800/50 flex items-center justify-center gap-2">
                  <span>⚠️</span> {loginError}
                </div>
              )}

              <form onSubmit={handleInitiateLogin} className="space-y-4">
                <div>
                  <input 
                    type="password" 
                    autoFocus
                    placeholder="••••" 
                    maxLength={10}
                    className="w-full bg-gray-950 border border-gray-700 text-white p-4 rounded-xl text-center text-3xl tracking-[0.4em] font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 transition shadow-inner"
                    value={authPin}
                    onChange={e => setAuthPin(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isLoggingIn || !authPin.trim()}
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white py-3.5 rounded-xl font-bold hover:from-red-500 hover:to-rose-500 transition shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <span className="animate-spin inline-block">⏳</span>
                      <span>Weryfikacja i wysyłka SMS...</span>
                    </>
                  ) : (
                    <>
                      <span>Dalej (Wyślij kod SMS)</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>
              <p className="text-[11px] text-gray-500 mt-5">
                🔒 Logowanie chronione uwierzytelnianiem dwuskładnikowym (2FA SMS)
              </p>
            </div>
          ) : (
            /* KROK 2: WPROWADZENIE JEDNORAZOWEGO KODU SMS */
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold mb-4 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Krok 2 z 2: Weryfikacja SMS
              </div>

              <div className="w-16 h-16 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
                📲
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-1">Kod Weryfikacyjny</h2>
              <p className="text-xs text-gray-400 mb-2">Wysłano 6-cyfrowy kod jednorazowy na numer:</p>
              
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-gray-200 font-mono font-medium mb-5">
                <span>📱</span>
                <span>{maskedPhone}</span>
              </div>

              {loginError && (
                <div className="mb-4 p-3 bg-red-950/60 text-red-400 rounded-xl text-xs border border-red-800/50 flex items-center justify-center gap-2">
                  <span>⚠️</span> {loginError}
                </div>
              )}

              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    autoFocus
                    placeholder="000000" 
                    maxLength={6}
                    className="w-full bg-gray-950 border border-gray-700 text-white p-4 rounded-xl text-center text-3xl tracking-[0.4em] font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition shadow-inner"
                    value={smsCode}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setSmsCode(val);
                      if (val.length === 6) {
                        // Opcjonalne natychmiastowe zatwierdzenie
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <span className={countdown > 30 ? "text-gray-400" : "text-red-400 font-semibold animate-pulse"}>
                    ⏱️ Kod wygasa za: {formatTime(countdown)}
                  </span>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || isLoggingIn}
                    className="text-amber-400 hover:text-amber-300 disabled:text-gray-600 transition font-medium underline-offset-2 hover:underline"
                  >
                    {resendCooldown > 0 ? `Wyślij ponownie (${resendCooldown}s)` : 'Wyślij kod ponownie'}
                  </button>
                </div>

                <button 
                  type="submit"
                  disabled={isLoggingIn || smsCode.length < 6 || countdown === 0}
                  className="w-full bg-gradient-to-r from-amber-500 via-rose-600 to-red-600 text-white py-3.5 rounded-xl font-bold hover:brightness-110 transition shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <span className="animate-spin inline-block">⏳</span>
                      <span>Autoryzacja 2FA...</span>
                    </>
                  ) : (
                    <>
                      <span>🔐 Zaloguj do Panelu SuperAdmin</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={handleBackToPin}
                  className="text-xs text-gray-400 hover:text-gray-200 transition flex items-center justify-center gap-1.5 mx-auto"
                >
                  <span>←</span>
                  <span>Wróć do wprowadzenia PIN</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const pendingBetaCount = betaApplications.filter(b => b.betaStatus === 'pending').length;

  // Filtrowanie listy tenantów
  let filteredTenants = tenants.filter(t => {
    // Wyszukiwanie tekstu
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      t.name?.toLowerCase().includes(q) || 
      (t.phoneNumber && t.phoneNumber.includes(q)) ||
      (t.contactEmail && t.contactEmail.toLowerCase().includes(q)) ||
      (t.assignedPhoneNumber && t.assignedPhoneNumber.includes(q));

    if (!matchesSearch) return false;

    // Filtr statusu
    if (statusFilter === 'HIGH_RISK') return t.riskLevel === 'HIGH';
    if (statusFilter === 'SUSPENDED') return t.isSuspended;
    if (statusFilter === 'BETA_PENDING') return t.betaStatus === 'pending';
    if (statusFilter === 'ACTIVE') return !t.isSuspended && t.riskLevel !== 'HIGH';

    return true;
  });

  filteredTenants.sort((a, b) => {
    if (sortBy === 'riskDesc') {
      const riskA = a.riskLevel === 'HIGH' ? 1 : 0;
      const riskB = b.riskLevel === 'HIGH' ? 1 : 0;
      if (riskA !== riskB) return riskB - riskA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'nameAsc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'minutesDesc') {
      const minA = a.subscription?.minutesUsed || 0;
      const minB = b.subscription?.minutesUsed || 0;
      return minB - minA;
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Górny pasek nawigacji SuperAdmin */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex flex-wrap justify-between items-center gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl flex items-center justify-center text-lg">
            🛡️
          </div>
          <div>
            <span className="font-black text-base tracking-tight text-white flex items-center gap-2">
              SuperAdmin EVA <span className="text-[10px] bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded-full font-bold">PRODUKCJA</span>
            </span>
          </div>
        </div>

        {/* Zakładki */}
        <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800">
          <button 
            onClick={() => { setActiveTab('tenants'); setShowListOnMobile(true); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'tenants' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            📋 Klienci ({tenants.length})
          </button>

          <button 
            onClick={() => { setActiveTab('beta'); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${activeTab === 'beta' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            <span>📥 Pilotaż Beta</span>
            {pendingBetaCount > 0 && (
              <span className="bg-amber-400 text-gray-950 px-1.5 py-0.2 rounded-full font-black text-[10px] animate-pulse">
                {pendingBetaCount}
              </span>
            )}
          </button>
        </div>

        {/* Narzędzia Push i Wylogowanie */}
        <div className="flex items-center gap-2">
          {pushStatus ? (
            <span className="text-xs text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">{pushStatus}</span>
          ) : (
            <button
              onClick={handleEnablePush}
              disabled={isEnablingPush}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              🔔 Włącz Alerty Push
            </button>
          )}

          <button
            onClick={fetchStats}
            title="Odśwież dane"
            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs"
          >
            🔄
          </button>

          <button
            onClick={handleLogout}
            className="bg-gray-800 hover:bg-red-950 text-gray-300 hover:text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-gray-700 hover:border-red-800"
          >
            🚪 Wyloguj
          </button>
        </div>
      </header>

      {/* PASEK KPI METRYK PLATFORMY */}
      <div className="bg-gray-900/60 border-b border-gray-800 px-4 py-3 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-7xl mx-auto">
          <div className="bg-gray-950 border border-gray-800 p-3 rounded-xl flex items-center gap-3">
            <span className="text-xl">🏢</span>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-400">Wszystkie Firmy</div>
              <div className="text-lg font-black text-white">{stats.totalTenants}</div>
            </div>
          </div>

          <div className="bg-gray-950 border border-red-900/40 p-3 rounded-xl flex items-center gap-3">
            <span className="text-xl">🚨</span>
            <div>
              <div className="text-[10px] uppercase font-bold text-red-400">High Risk (TOS)</div>
              <div className="text-lg font-black text-red-400">{stats.highRiskTenants}</div>
            </div>
          </div>

          <div className="bg-gray-950 border border-amber-900/40 p-3 rounded-xl flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-400">Wnioski Beta</div>
              <div className="text-lg font-black text-amber-400">{stats.pendingBeta}</div>
            </div>
          </div>

          <div className="bg-gray-950 border border-blue-900/40 p-3 rounded-xl flex items-center gap-3">
            <span className="text-xl">⏱️</span>
            <div>
              <div className="text-[10px] uppercase font-bold text-blue-400">Minuty Użyte</div>
              <div className="text-lg font-black text-blue-400">{stats.totalMinutesUsed} min</div>
            </div>
          </div>
        </div>
      </div>

      {/* GŁÓWNA ZAWARTOŚĆ: TAB 1 - WNIOSKI PILOTAŻOWE BETA */}
      {activeTab === 'beta' ? (
        <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">📥 Wnioski do Programu Pilotażowego (Premium)</h1>
              <p className="text-sm text-gray-400 mt-1">
                Zgłoszenia firm ubiegających się o darmowy miesięczny pakiet Premium. Przypisz numer Zadarma i aktywuj konto.
              </p>
            </div>
            <button 
              onClick={fetchBetaApplications}
              className="bg-gray-850 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-800 shadow-sm"
            >
              🔄 Odśwież listę
            </button>
          </div>

          {betaApplications.length === 0 ? (
            <div className="bg-gray-900 p-12 text-center rounded-2xl border border-gray-800 text-gray-400 italic">
              Brak zgłoszeń do programu pilotażowego.
            </div>
          ) : (
            <div className="space-y-4">
              {betaApplications.map(app => (
                <div 
                  key={app.id} 
                  className={`bg-gray-900 rounded-2xl p-6 border shadow-sm transition ${app.betaStatus === 'pending' ? 'border-amber-500/50 ring-2 ring-amber-500/20' : 'border-gray-800'}`}
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-white">{app.name}</h2>
                        {app.betaStatus === 'pending' ? (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            ⏳ OCZEKUJE NA AKTYWACJĘ
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            ✅ ZATWIERDZONY (PILOTAŻ)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Zgłoszono: {app.betaRequestedAt ? new Date(app.betaRequestedAt).toLocaleString('pl-PL') : 'Brak daty'}
                        {app.betaApprovedAt && ` | Zaakceptowano: ${new Date(app.betaApprovedAt).toLocaleString('pl-PL')}`}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {app.betaStatus === 'pending' ? (
                        <button
                          onClick={() => openApproveModal(app)}
                          className="bg-amber-500 hover:bg-amber-600 text-gray-950 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-1.5"
                        >
                          ⚡ Przypisz numer i Aktywuj
                        </button>
                      ) : (
                        <button
                          onClick={() => openApproveModal(app)}
                          className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-xl font-semibold text-xs transition"
                        >
                          ⚙️ Edytuj numer / PIN
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteModal(app)}
                        className="bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/40 px-3.5 py-2 rounded-xl font-semibold text-xs transition flex items-center gap-1 shrink-0"
                        title="Usuń wniosek pilotażowy"
                      >
                        🗑️ Usuń wniosek
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 bg-gray-950 p-4 rounded-xl text-sm border border-gray-800 mb-4">
                    <div>
                      <span className="text-xs text-gray-400 block">Osoba kontaktowa:</span>
                      <strong className="text-white">{app.betaContactPerson || 'Nie podano'}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Telefon komórkowy:</span>
                      <a href={`tel:${app.phoneNumber}`} className="font-mono text-blue-400 font-bold hover:underline">
                        {app.phoneNumber}
                      </a>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Adres E-mail:</span>
                      <a href={`mailto:${app.betaContactEmail || app.contactEmail}`} className="text-blue-400 hover:underline">
                        {app.betaContactEmail || app.contactEmail || 'Nie podano'}
                      </a>
                    </div>
                  </div>

                  {app.betaNotes && (
                    <div className="bg-amber-950/20 p-3 rounded-xl border border-amber-900/40 text-xs text-amber-300 mb-4">
                      <strong>Notatka od firmy:</strong> {app.betaNotes}
                    </div>
                  )}

                  {/* Szczegóły aktywnego pilotażu */}
                  {app.assignedPhoneNumber && (
                    <div className="flex flex-wrap items-center gap-4 text-xs bg-emerald-950/20 text-emerald-300 p-3 rounded-xl border border-emerald-900/40">
                      <div>
                        Wirtualny numer SIP: <strong className="font-mono text-emerald-200 font-bold text-sm">{app.assignedPhoneNumber}</strong>
                      </div>
                      <div>
                        PIN: <strong className="font-mono font-bold">{app.pinCode || 'Brak'}</strong>
                      </div>
                      <div>
                        Minuty: <strong>{app.subscription?.minutesUsed || 0} / {app.subscription?.minutesIncluded || 300}</strong>
                      </div>
                    </div>
                  )}

                  {/* MODAL / FORMULARZ AKTYWACJI */}
                  {approvingTenantId === app.id && (
                    <div className="mt-4 p-5 bg-gray-950 text-white rounded-2xl shadow-xl border border-amber-500/40">
                      <h3 className="font-bold text-base mb-2 text-amber-400">
                        🚀 Aktywacja Pilotażu Premium dla: {app.name}
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Wpisz zakupiony w Zadarma numer telefonu. Firma otrzyma pełny pakiet Premium oraz automatyczny SMS z potwierdzeniem.
                      </p>

                      <div className="grid sm:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-300 mb-1">
                            Numer wirtualny (Zadarma) *
                          </label>
                          <input 
                            type="text"
                            value={assignedNumberInput}
                            onChange={e => setAssignedNumberInput(e.target.value)}
                            placeholder="+48..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm font-mono text-white focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-300 mb-1 flex justify-between">
                            <span>Kod PIN *</span>
                            <button 
                              type="button"
                              onClick={() => setPinInput(Math.floor(1000 + Math.random() * 9000).toString())}
                              className="text-[10px] text-amber-400 hover:underline"
                            >
                              Losuj inny
                            </button>
                          </label>
                          <input 
                            type="text"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm font-mono text-white focus:ring-2 focus:ring-amber-500"
                          />
                          {app.pinCode && pinInput === app.pinCode && (
                            <span className="text-[10px] text-emerald-400 mt-1 block">
                              ✓ PIN ustalony przez firmę przy rejestracji
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-300 mb-1">
                            Pakiet darmowych minut
                          </label>
                          <input 
                            type="number"
                            value={minutesInput}
                            onChange={e => setMinutesInput(parseInt(e.target.value, 10))}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setApprovingTenantId(null)}
                          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium"
                        >
                          Anuluj
                        </button>
                        <button
                          type="button"
                          disabled={isApproving}
                          onClick={() => submitApproveBeta(app.id)}
                          className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-lg text-xs shadow-lg transition disabled:opacity-50"
                        >
                          {isApproving ? 'Aktywowanie...' : '✅ Zatwierdź i Aktywuj Pakiet'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* MODAL POTWIERDZENIA USUNIĘCIA WNIOSKU */}
          {deletingApp && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-500/40">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center mx-auto mb-4 text-2xl">
                  🗑️
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-1">
                  Usuwanie Wniosku Pilotażowego
                </h3>
                <p className="text-xs text-gray-400 text-center mb-4">
                  Czy na pewno chcesz usunąć wniosek pilotażowy dla firmy:
                  <strong className="block text-white mt-1 text-sm font-bold">{deletingApp.name}</strong>
                  <span className="font-mono text-gray-400 text-xs">({deletingApp.phoneNumber})</span>
                </p>

                <div className="space-y-3 mb-5">
                  <label className="flex items-start gap-2.5 p-3 bg-gray-950 rounded-xl border border-gray-800 cursor-pointer text-xs">
                    <input 
                      type="checkbox"
                      checked={deleteEntireAccount}
                      onChange={e => setDeleteEntireAccount(e.target.checked)}
                      className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <span className="text-gray-300">
                      <strong>Usuń także całe konto testowe i dane firmy</strong> z bazy danych (trwałe usunięcie)
                    </span>
                  </label>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                      Wpisz <span className="font-mono text-red-400 font-bold bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/40">Potwierdź</span> aby odblokować przycisk:
                    </label>
                    <input 
                      type="text" 
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder="Potwierdź"
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl p-2.5 text-sm text-center font-semibold text-white focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setDeletingApp(null); setDeleteConfirmText(''); }}
                    className="px-4 py-2 text-xs text-gray-400 hover:text-white font-medium"
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting || (deleteConfirmText.trim().toLowerCase() !== 'potwierdź' && deleteConfirmText.trim().toLowerCase() !== 'potwierdz')}
                    onClick={handleConfirmDelete}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {isDeleting ? 'Usuwanie...' : 'Potwierdź usunięcie'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* GŁÓWNA ZAWARTOŚĆ: TAB 2 - PEŁNA LISTA TENANTÓW I MODERACJA AI */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LSB: Lista Tenantów */}
          <div className={`w-full md:w-1/3 border-r border-gray-800 bg-gray-900 flex flex-col h-full overflow-hidden ${!showListOnMobile ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 bg-gray-950 border-b border-gray-800 flex justify-between items-center shrink-0">
              <span className="font-black text-sm text-white flex items-center gap-2">
                <span>🛡️</span> Moderacja i Bezpieczeństwo
              </span>
              <span className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                {filteredTenants.length} / {tenants.length}
              </span>
            </div>
            
            {/* Paski filtrów i wyszukiwania */}
            <div className="p-3 border-b border-gray-800 bg-gray-900/80 shrink-0 flex flex-col gap-2.5">
              <input 
                type="text" 
                placeholder="Szukaj nazwy, telefonu, SIP, e-mail..." 
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* Pigułki filtrów statusu */}
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'ALL', label: 'Wszystkie' },
                  { id: 'HIGH_RISK', label: '🚨 High Risk' },
                  { id: 'SUSPENDED', label: '🚫 Zawieszone' },
                  { id: 'ACTIVE', label: '✅ Aktywne' },
                  { id: 'BETA_PENDING', label: '⏳ Beta' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${statusFilter === f.id ? 'bg-red-600 text-white shadow' : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <select 
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-xs text-gray-300"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="riskDesc">Sortuj: Ryzyko od najwyższego (HIGH RISK)</option>
                <option value="nameAsc">Sortuj: Nazwa alfabetycznie (A-Z)</option>
                <option value="minutesDesc">Sortuj: Minuty od najwyższych</option>
              </select>
            </div>

            {/* Lista kafelków tenantów */}
            <div className="divide-y divide-gray-800/80 overflow-y-auto flex-1">
              {filteredTenants.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => fetchTenantDetails(t.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-800/50 transition flex flex-col gap-1.5 ${selectedTenant?.id === t.id ? 'bg-gray-800 border-l-4 border-red-500' : ''}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <strong className="text-sm font-bold text-white truncate">{t.name}</strong>
                    {t.riskLevel === 'HIGH' && (
                      <span className="bg-red-500/20 text-red-400 border border-red-500/50 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse shrink-0">
                        🚨 HIGH RISK
                      </span>
                    )}
                    {t.riskLevel === 'LOW' && (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0">
                        LOW
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-400 flex flex-wrap gap-x-2">
                    <span>📞 {t.phoneNumber}</span>
                    {t.assignedPhoneNumber && <span className="font-mono text-emerald-400">SIP: {t.assignedPhoneNumber}</span>}
                  </div>

                  <div className="text-[11px] text-gray-400 mt-1 flex justify-between items-center">
                    <span>Minuty: <strong className="text-gray-300">{t.subscription?.minutesUsed || 0}</strong> / {t.subscription?.minutesIncluded || 0}</span>
                    <div className="flex gap-1">
                      {t.isSuspended && <span className="bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.2 rounded text-[10px] font-bold">ZAWIESZONY</span>}
                      {t.subscription?.status === 'paused' && <span className="bg-amber-950 text-amber-400 border border-amber-800 px-1.5 py-0.2 rounded text-[10px] font-bold">PAUZA</span>}
                    </div>
                  </div>
                </div>
              ))}
              {filteredTenants.length === 0 && (
                <div className="p-8 text-center text-gray-500 italic text-xs">Brak firm spełniających kryteria wyszukiwania</div>
              )}
            </div>
          </div>

          {/* RSB: Szczegóły Moderacji i Zarządzania Firmą */}
          <div className={`w-full md:w-2/3 h-full overflow-y-auto p-4 md:p-6 bg-gray-950 ${showListOnMobile ? 'hidden md:block' : 'block'}`}>
            {!selectedTenant ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm hidden md:flex">
                <span className="text-4xl mb-3 opacity-30">🛡️</span>
                Wybierz firmę z listy po lewej stronie, aby zarządzać profilem, moderacją i subskrypcją
              </div>
            ) : (
              <div className="bg-gray-900 p-5 md:p-6 rounded-3xl shadow-xl border border-gray-800">
                <button 
                  onClick={() => setShowListOnMobile(true)}
                  className="md:hidden mb-4 text-blue-400 font-semibold flex items-center gap-1 text-xs"
                >
                  ← Powrót do listy
                </button>

                {/* Nagłówek wybranej firmy z akcjami */}
                <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-6 gap-4 border-b border-gray-800 pb-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl md:text-3xl font-black text-white">{selectedTenant.name}</h1>
                      {selectedTenant.riskLevel === 'HIGH' && (
                        <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-black animate-pulse">
                          🚨 HIGH RISK
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      {selectedTenant.isSuspended ? (
                        <span className="bg-red-950 text-red-400 border border-red-800 px-2.5 py-0.5 rounded-full font-bold">🚫 Konto Zawieszone</span>
                      ) : (
                        <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold">✅ Konto Aktywne</span>
                      )}
                      <span className="text-gray-400">📞 {selectedTenant.phoneNumber}</span>
                      {selectedTenant.assignedPhoneNumber && (
                        <span className="bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 px-2.5 py-0.5 rounded-full font-mono font-bold">
                          SIP: {selectedTenant.assignedPhoneNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Przyciski operacyjne */}
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button 
                      onClick={() => handleAuditTenant(selectedTenant.id)}
                      disabled={isAuditing}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow text-xs transition disabled:opacity-50 flex items-center gap-1"
                    >
                      {isAuditing ? '⏳ Skanuję...' : '🔍 Audyt AI (TOS)'}
                    </button>

                    <button 
                      onClick={() => handleAction(selectedTenant.id, 'approve')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow text-xs transition"
                    >
                      ✅ Approve
                    </button>

                    <button 
                      onClick={() => handleAction(selectedTenant.id, 'suspend', { suspend: !selectedTenant.isSuspended })}
                      className={`px-3 py-1.5 font-bold rounded-xl shadow text-xs transition ${selectedTenant.isSuspended ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                    >
                      {selectedTenant.isSuspended ? '🔓 Odblokuj' : '🚫 Zawieś'}
                    </button>

                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        const defaultMsg = selectedTenant.riskLevel === 'HIGH'
                          ? `EVA: Dzień dobry. Zgodnie z § 2 ust. 5 Regulaminu (veritas-app.com/eva/regulamin), weryfikacja bazy wiedzy FAQ Twojego asystenta wykryła naruszenie: ${selectedTenant.moderationNotes || 'niezgodność treści z regulaminem'}. Prosimy o korektę wpisów w panelu.`
                          : "";
                        const msg = window.prompt("Wpisz treść wiadomości SMS do właściciela firmy:", defaultMsg);
                        if (msg) handleAction(selectedTenant.id, "sms", { message: msg });
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow text-xs transition"
                    >
                      ✉️ SMS
                    </button>

                    <button 
                      onClick={() => {
                        setDeletingTenant(selectedTenant);
                        setDeleteTenantConfirmText('');
                      }}
                      className="px-3 py-1.5 bg-red-950 text-red-400 hover:bg-red-900 border border-red-800 font-bold rounded-xl text-xs transition flex items-center gap-1"
                    >
                      🗑️ Usuń konto
                    </button>
                  </div>
                </div>

                {/* Sekcja Oflagowania przez AI (HIGH RISK BANNER) */}
                {selectedTenant.riskLevel === 'HIGH' && selectedTenant.moderationNotes && (
                  <div className="bg-red-950/40 border border-red-600 p-4 mb-6 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-red-400 font-black text-sm">
                        <span>🚨</span> Naruszenie Regulaminu Platformy (§ 2 ust. 5 TOS):
                      </div>
                      <button
                        onClick={() => {
                          const defaultMsg = `EVA: Dzień dobry. Zgodnie z § 2 ust. 5 Regulaminu (veritas-app.com/eva/regulamin), weryfikacja bazy wiedzy FAQ Twojego asystenta wykryła niezgodność: ${selectedTenant.moderationNotes}. Prosimy o pilną korektę w panelu lub kontakt.`;
                          const msg = window.prompt("Treść powiadomienia SMS (wezwanie na podstawie § 2 ust. 5 Regulaminu):", defaultMsg);
                          if (msg) handleAction(selectedTenant.id, "sms", { message: msg });
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow shrink-0"
                      >
                        ✉️ Wyślij wezwanie SMS (§ 2 ust. 5)
                      </button>
                    </div>
                    <p className="text-red-300 text-xs leading-relaxed">{selectedTenant.moderationNotes}</p>
                    <div className="mt-2.5 pt-2 border-t border-red-900/60 text-[11px] text-gray-400 flex items-center gap-1.5">
                      <span>⚖️</span>
                      <span><strong>Podstawa prawna:</strong> § 2 ust. 5 Regulaminu — audyt dotyczy wyłącznie jawnych wpisów FAQ/profilu firmy (zapobieganie przestępstwom i poradom medycznym). Monitoring wyklucza podsłuchiwanie prywatnych rozmów klientów.</span>
                    </div>
                  </div>
                )}

                {/* Dwie kolumny: Profil i FAQ */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                  {/* Sekcja Profilu Biznesowego */}
                  <div className="border border-gray-800 rounded-2xl p-4 bg-gray-950 flex flex-col max-h-[400px]">
                    <h3 className="font-bold text-xs uppercase tracking-wider mb-2 text-gray-400">
                      Profil Biznesowy i Wytyczne AI
                    </h3>
                    <div className="whitespace-pre-wrap text-xs bg-gray-900 p-3 rounded-xl border border-gray-800 font-mono text-gray-200 overflow-y-auto flex-1 leading-relaxed">
                      {selectedTenant.profession && <div className="mb-2 text-purple-400 font-bold">Profesja: {selectedTenant.profession}</div>}
                      {selectedTenant.bioSummary && <div className="mb-2 text-gray-300"><strong>Bio:</strong> {selectedTenant.bioSummary}</div>}
                      {selectedTenant.qualificationPrompt && <div className="mb-2 text-amber-300"><strong>Kwalifikacja:</strong> {selectedTenant.qualificationPrompt}</div>}
                      {selectedTenant.serviceAreaDescription && <div className="mb-2 text-blue-300"><strong>Obszar:</strong> {selectedTenant.serviceAreaDescription}</div>}
                      <div className="text-gray-400">
                        <strong>Profil bazowy:</strong> {selectedTenant.businessProfile || 'Brak'}
                      </div>
                    </div>
                  </div>

                  {/* Sekcja FAQ (Baza Wiedzy) z przyciskiem usuwania wpisów */}
                  <div className="border border-gray-800 rounded-2xl p-4 bg-gray-950 flex flex-col max-h-[400px]">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">
                          Baza Wiedzy (FAQ) ({selectedTenant.faqEntries?.length || 0})
                        </h3>
                        <span className="text-[10px] text-gray-500">
                          Audyt zgodności z § 2 ust. 5 Regulaminu (brak niedozwolonych porad / przestępstw)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
                      {selectedTenant.faqEntries?.map((f: any, idx: number) => (
                        <div key={f.id} className="bg-gray-900 p-3.5 rounded-xl border border-gray-800 text-xs flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                              <span>#{idx + 1} Q:</span> {f.question}
                              {f.isConfidential && (
                                <span className="text-[10px] bg-purple-950 text-purple-400 border border-purple-800 px-1.5 py-0.2 rounded font-mono">
                                  🔒 PIN
                                </span>
                              )}
                            </div>
                            <div className="text-gray-300 leading-relaxed">A: {f.answer}</div>
                          </div>

                          <button
                            onClick={() => handleDeleteFaq(selectedTenant.id, f.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/40 p-1 rounded transition text-xs shrink-0"
                            title="Usuń ten wpis FAQ"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                      {(!selectedTenant.faqEntries || selectedTenant.faqEntries.length === 0) && (
                        <div className="text-gray-500 italic text-center p-8 text-xs">Brak wpisów FAQ</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Zarządzanie Abonamentem */}
                <div className="border-t border-gray-800 pt-5 mt-4">
                  <h3 className="font-bold text-sm mb-3 text-white">⚙️ Zarządzanie Abonamentem</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-gray-950 p-4 rounded-2xl border border-gray-800">
                    <div className="text-xs">
                      <div>Plan: <strong className="uppercase text-white">{selectedTenant.subscription?.planName || 'Brak'}</strong></div>
                      <div className="mt-1">
                        Status: <span className={`font-bold uppercase ${selectedTenant.subscription?.status === 'paused' ? 'text-amber-400' : selectedTenant.subscription?.status === 'active' ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {selectedTenant.subscription?.status || 'none'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto w-full sm:w-auto">
                      <button 
                        onClick={() => handleAction(selectedTenant.id, 'adjust-minutes', { additionalMinutes: 100 })}
                        className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 rounded-lg hover:bg-blue-600/30 font-bold text-xs"
                      >
                        +100 Minut
                      </button>
                      <button 
                        onClick={() => handleAction(selectedTenant.id, 'adjust-minutes', { additionalMinutes: -100 })}
                        className="px-3 py-1.5 bg-red-600/20 border border-red-500/40 text-red-300 rounded-lg hover:bg-red-600/30 font-bold text-xs"
                      >
                        -100 Minut
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL POTWIERDZENIA USUNIĘCIA KONTA TENANTA */}
      {deletingTenant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-500/50">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center mx-auto mb-4 text-2xl">
              🗑️
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-1">
              Trwałe Usunięcie Konta Klienta
            </h3>
            <p className="text-xs text-gray-400 text-center mb-4">
              Czy na pewno chcesz bezpowrotnie usunąć konto firmy:
              <strong className="block text-white mt-1 text-sm font-bold">{deletingTenant.name}</strong>
              <span className="font-mono text-gray-400 text-xs">({deletingTenant.phoneNumber})</span>
            </p>
            <p className="text-[11px] text-red-400 bg-red-950/40 p-3 rounded-xl border border-red-900/50 mb-4 text-center">
              ⚠️ Wszystkie powiązane dane (połączenia, wiadomości, rezerwacje, FAQ, usługi) zostaną trwale skasowane!
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Wpisz <span className="font-mono text-red-400 font-bold bg-red-950 px-1.5 py-0.5 rounded border border-red-800">Usuń</span> aby odblokować przycisk:
              </label>
              <input 
                type="text" 
                value={deleteTenantConfirmText}
                onChange={e => setDeleteTenantConfirmText(e.target.value)}
                placeholder="Usuń"
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-2.5 text-sm text-center font-bold text-white focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setDeletingTenant(null); setDeleteTenantConfirmText(''); }}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white font-medium"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={isDeletingTenant || (deleteTenantConfirmText.trim().toLowerCase() !== 'usuń' && deleteTenantConfirmText.trim().toLowerCase() !== 'usun')}
                onClick={handleConfirmDeleteTenant}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {isDeletingTenant ? 'Usuwanie...' : 'Trwale usuń konto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
