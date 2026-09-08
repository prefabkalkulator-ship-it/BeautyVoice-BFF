import React, { useState, useEffect } from 'react';
import { requestForToken } from '../firebase';

export function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [betaApplications, setBetaApplications] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authPin, setAuthPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Tab: 'tenants' | 'beta'
  const [activeTab, setActiveTab] = useState<'tenants' | 'beta'>('tenants');

  // Nowe stany do wyszukiwania i sortowania
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('riskDesc');
  
  // Stan do przełączania widoków na urządzeniach mobilnych
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

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenants();
      fetchBetaApplications();
    }
  }, [isAuthenticated]);

  const fetchTenants = async () => {
    try {
      const res = await fetch(`/api/admin/tenants`);
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBetaApplications = async () => {
    try {
      const res = await fetch('/api/admin/beta-applications');
      if (res.ok) {
        const data = await res.json();
        setBetaApplications(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTenantDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tenants/${id}`);
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
      const res = await fetch('/api/admin/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          label: 'SuperAdmin Phone PWA (' + new Date().toLocaleDateString() + ')'
        })
      });
      if (res.ok) {
        setPushStatus('✅ Powiadomienia PWA aktywne na tym telefonie');
        alert('🔔 Powiadomienia PWA włączone! Będziesz otrzymywać alerty dźwiękowe o nowych salonach zgłaszających się do EVA.');
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

  const openApproveModal = (tenant: any) => {
    setApprovingTenantId(tenant.id);
    setAssignedNumberInput(tenant.assignedPhoneNumber || '+48');
    setPinInput(Math.floor(1000 + Math.random() * 9000).toString());
    setMinutesInput(300);
  };

  const submitApproveBeta = async (tenantId: string) => {
    if (!assignedNumberInput || assignedNumberInput.trim().length < 9) {
      alert('Wprowadź prawidłowy wirtualny numer telefonu zakupiony w Zadarma (np. +48459568507)');
      return;
    }

    if (!window.confirm(`Czy na pewno chcesz aktywować salon i wysłać SMS z PINem (${pinInput}) na numer klienta?`)) {
      return;
    }

    setIsApproving(true);
    try {
      const res = await fetch(`/api/admin/beta-applications/${tenantId}/approve`, {
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

      alert(`🎉 Sukces! Konto salonu zostało aktywowane z pakietem 300 minut.\n\nPrzypisany numer: ${data.assignedPhoneNumber}\nKod PIN: ${data.pinCode}\nSMS wysłany: ${data.smsSent ? 'TAK' : 'NIE'}`);
      setApprovingTenantId(null);
      await fetchBetaApplications();
      await fetchTenants();
      if (selectedTenant && selectedTenant.id === tenantId) {
        await fetchTenantDetails(tenantId);
      }
    } catch (err: any) {
      alert('Błąd połączenia: ' + err.message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleAction = async (id: string, action: string, payload: any = {}) => {
    const actionLabels: Record<string, string> = {
      approve: 'Zatwierdź profil jako bezpieczny',
      suspend: payload.suspend ? 'Zawieś całe konto (blokada AI i połączeń)' : 'Odblokuj konto użytkownika',
      'adjust-minutes': `Zmień minuty (${payload.additionalMinutes > 0 ? '+' : ''}${payload.additionalMinutes} min)`,
      sms: 'Wyślij wiadomość SMS',
      'subscription/status': payload.status === 'active' ? 'Wznów subskrypcję użytkownika (Status: active)' : 'Zawieś subskrypcję na 30 dni (Status: paused)'
    };
    const confirmPrompt = actionLabels[action] || action;
    if (!window.confirm(`Czy na pewno chcesz wykonać operację: "${confirmPrompt}"?`)) return;
    try {
      const res = await fetch(`/api/admin/tenants/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Błąd: ${err.error || res.statusText}`);
      }
      await fetchTenants();
      await fetchBetaApplications();
      if (selectedTenant && selectedTenant.id === id) {
        await fetchTenantDetails(id);
      }
    } catch (e) {
      console.error(e);
      alert('Błąd połączenia z serwerem');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-xl w-96 text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Super Admin EVA</h2>
          <p className="text-xs text-gray-500 mb-4">Zarządzanie platformą i weryfikacja salonów</p>
          <input 
            type="password" 
            placeholder="Wprowadź kod PIN" 
            className="w-full border p-2 rounded mb-4"
            value={authPin}
            onChange={e => setAuthPin(e.target.value)}
          />
          <button 
            className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700 transition"
            onClick={() => { if (authPin === '7777') setIsAuthenticated(true); else alert('Błędny PIN'); }}
          >
            Zaloguj
          </button>
        </div>
      </div>
    );
  }

  const pendingBetaCount = betaApplications.filter(b => b.betaStatus === 'pending').length;

  // Filtrowanie i sortowanie listy tenantów
  let filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.phoneNumber && t.phoneNumber.includes(searchTerm))
  );

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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Górny pasek nawigacji SuperAdmin */}
      <header className="bg-gray-900 text-white px-4 py-3 flex flex-wrap justify-between items-center gap-4 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-red-400">🛡️ SuperAdmin EVA</span>
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">v2.0 Beta</span>
        </div>

        {/* Zakładki */}
        <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg">
          <button 
            onClick={() => { setActiveTab('tenants'); setShowListOnMobile(true); }}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${activeTab === 'tenants' ? 'bg-red-600 text-white' : 'text-gray-300 hover:text-white'}`}
          >
            📋 Wszyscy Klienci ({tenants.length})
          </button>

          <button 
            onClick={() => { setActiveTab('beta'); }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'beta' ? 'bg-amber-600 text-white' : 'text-gray-300 hover:text-white'}`}
          >
            <span>📥 Wnioski Pilotażowe</span>
            {pendingBetaCount > 0 && (
              <span className="bg-amber-400 text-gray-950 px-1.5 py-0.2 rounded-full font-bold text-[10px] animate-pulse">
                {pendingBetaCount}
              </span>
            )}
          </button>
        </div>

        {/* Przycisk włączania powiadomień Push */}
        <div className="flex items-center gap-2">
          {pushStatus ? (
            <span className="text-xs text-green-400 font-medium">{pushStatus}</span>
          ) : (
            <button
              onClick={handleEnablePush}
              disabled={isEnablingPush}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              🔔 Włącz Push na tym telefonie
            </button>
          )}
        </div>
      </header>

      {/* GŁÓWNA ZAWARTOŚĆ: TAB 1 - WNIOSKI PILOTAŻOWE BETA */}
      {activeTab === 'beta' ? (
        <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📥 Wnioski do Programu Pilotażowego (Beta 3M)</h1>
              <p className="text-sm text-gray-500 mt-1">
                Zgłoszenia salonów beauty ubiegających się o darmowy 3-miesięczny dostęp. Przypisz zakupiony w Zadarma numer i aktywuj konto.
              </p>
            </div>
            <button 
              onClick={fetchBetaApplications}
              className="bg-white border text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 shadow-sm"
            >
              🔄 Odśwież listę
            </button>
          </div>

          {betaApplications.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border text-gray-400 italic">
              Brak zgłoszeń do programu pilotażowego.
            </div>
          ) : (
            <div className="space-y-4">
              {betaApplications.map(app => (
                <div 
                  key={app.id} 
                  className={`bg-white rounded-2xl p-6 border shadow-sm transition ${app.betaStatus === 'pending' ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-gray-200'}`}
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-gray-900">{app.name}</h2>
                        {app.betaStatus === 'pending' ? (
                          <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-300">
                            ⏳ OCZEKUJE NA AKTYWACJĘ
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            ✅ ZATWIERDZONY (PILOTAŻ)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Zgłoszono: {app.betaRequestedAt ? new Date(app.betaRequestedAt).toLocaleString('pl-PL') : 'Brak daty'}
                        {app.betaApprovedAt && ` | Zaakceptowano: ${new Date(app.betaApprovedAt).toLocaleString('pl-PL')}`}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {app.betaStatus === 'pending' ? (
                        <button
                          onClick={() => openApproveModal(app)}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-1.5"
                        >
                          ⚡ Przypisz numer i Aktywuj
                        </button>
                      ) : (
                        <button
                          onClick={() => openApproveModal(app)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-semibold text-xs transition"
                        >
                          ⚙️ Edytuj numer / PIN
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl text-sm border mb-4">
                    <div>
                      <span className="text-xs text-gray-400 block">Osoba kontaktowa:</span>
                      <strong className="text-gray-800">{app.betaContactPerson || 'Nie podano'}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Telefon komórkowy:</span>
                      <a href={`tel:${app.phoneNumber}`} className="font-mono text-blue-600 font-bold hover:underline">
                        {app.phoneNumber}
                      </a>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Adres E-mail:</span>
                      <a href={`mailto:${app.betaContactEmail || app.contactEmail}`} className="text-blue-600 hover:underline">
                        {app.betaContactEmail || app.contactEmail || 'Nie podano'}
                      </a>
                    </div>
                  </div>

                  {app.betaNotes && (
                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 mb-4">
                      <strong>Notatka od salonu:</strong> {app.betaNotes}
                    </div>
                  )}

                  {/* Szczegóły aktywnego pilotażu */}
                  {app.assignedPhoneNumber && (
                    <div className="flex flex-wrap items-center gap-4 text-xs bg-emerald-50 text-emerald-900 p-3 rounded-xl border border-emerald-200">
                      <div>
                        Wirtualny numer SIP: <strong className="font-mono text-emerald-950 font-bold text-sm">{app.assignedPhoneNumber}</strong>
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
                    <div className="mt-4 p-5 bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl shadow-xl border border-gray-700">
                      <h3 className="font-bold text-base mb-2 text-amber-400">
                        🚀 Aktywacja Pilotażu dla: {app.name}
                      </h3>
                      <p className="text-xs text-gray-300 mb-4">
                        Wpisz zakupiony w Zadarma numer telefonu. Po kliknięciu salon otrzyma darmowy pakiet oraz automatyczny SMS z kodem PIN.
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
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm font-mono text-white focus:ring-2 focus:ring-amber-500"
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
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm font-mono text-white focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-300 mb-1">
                            Pakiet darmowych minut
                          </label>
                          <input 
                            type="number"
                            value={minutesInput}
                            onChange={e => setMinutesInput(parseInt(e.target.value, 10))}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setApprovingTenantId(null)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium"
                        >
                          Anuluj
                        </button>
                        <button
                          type="button"
                          disabled={isApproving}
                          onClick={() => submitApproveBeta(app.id)}
                          className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-lg text-xs shadow-lg transition disabled:opacity-50"
                        >
                          {isApproving ? 'Aktywowanie...' : '✅ Zatwierdź i Wyślij SMS z PINem'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* GŁÓWNA ZAWARTOŚĆ: TAB 2 - PEŁNA LISTA TENANTÓW I MODERACJA AI */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LSB: Lista Tenantów */}
          <div className={`w-full md:w-1/3 border-r bg-white flex flex-col h-full overflow-hidden ${!showListOnMobile ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 bg-gray-800 text-white font-bold text-base flex justify-between items-center shrink-0">
              <span>🛡️ Moderacja Salonów</span>
              <span className="text-xs font-normal bg-gray-700 px-2 py-0.5 rounded">Razem: {filteredTenants.length}</span>
            </div>
            
            {/* Pasek wyszukiwania i sortowania */}
            <div className="p-3 border-b bg-gray-50 shrink-0 flex flex-col gap-2">
              <input 
                type="text" 
                placeholder="Szukaj nazwy lub telefonu..." 
                className="w-full border rounded p-2 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select 
                className="w-full border rounded p-2 text-sm bg-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="riskDesc">Ryzyko: od najwyższego</option>
                <option value="nameAsc">Nazwa: A-Z</option>
                <option value="minutesDesc">Minuty: od najwyższych</option>
              </select>
            </div>

            <div className="divide-y overflow-y-auto flex-1">
              {filteredTenants.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => fetchTenantDetails(t.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-100 transition flex flex-col gap-1 ${selectedTenant?.id === t.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <strong className="text-base text-gray-900">{t.name}</strong>
                    {t.riskLevel === 'HIGH' && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold animate-pulse">HIGH RISK</span>}
                    {t.riskLevel === 'LOW' && <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded">LOW</span>}
                  </div>
                  <div className="text-xs text-gray-500">📞 {t.phoneNumber} {t.contactEmail && <span className="ml-1 text-gray-400">| ✉️ {t.contactEmail}</span>}</div>
                  <div className="text-xs text-gray-400 mt-1 flex justify-between items-center">
                    <span>Minuty: {t.subscription?.minutesUsed || 0} / {t.subscription?.minutesIncluded || 0}</span>
                    <div className="flex gap-1">
                      {t.betaStatus === 'pending' && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold text-[10px]">BETA WNIOSEK</span>}
                      {t.isSuspended && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold text-[10px]">ZAWIESZONY</span>}
                      {t.subscription?.status === 'paused' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold text-[10px]">PAUZA SUB</span>}
                    </div>
                  </div>
                </div>
              ))}
              {filteredTenants.length === 0 && (
                <div className="p-4 text-center text-gray-400 italic">Brak wyników</div>
              )}
            </div>
          </div>

          {/* RSB: Szczegóły Moderacji */}
          <div className={`w-full md:w-2/3 h-full overflow-y-auto p-4 md:p-6 bg-gray-50 ${showListOnMobile ? 'hidden md:block' : 'block'}`}>
            {!selectedTenant ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-base hidden md:flex">
                Wybierz salon z listy po lewej, aby zarządzać profilem
              </div>
            ) : (
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border">
                <button 
                  onClick={() => setShowListOnMobile(true)}
                  className="md:hidden mb-4 text-blue-600 font-semibold flex items-center gap-1 text-sm"
                >
                  ← Powrót do listy
                </button>

                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4 border-b pb-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold break-words text-gray-900">{selectedTenant.name}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {selectedTenant.isSuspended ? (
                        <span className="bg-red-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">🚫 Konto Zawieszone</span>
                      ) : (
                        <span className="bg-green-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">✅ Konto Aktywne</span>
                      )}
                      {selectedTenant.subscription?.status === 'paused' && (
                        <span className="bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-bold">⏸️ Abonament Wstrzymany</span>
                      )}
                      {selectedTenant.assignedPhoneNumber && (
                        <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-full font-mono font-bold">
                          SIP: {selectedTenant.assignedPhoneNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button 
                      onClick={() => handleAction(selectedTenant.id, 'approve')}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow text-xs"
                    >
                      ✅ Approve
                    </button>
                    <button 
                      onClick={() => handleAction(selectedTenant.id, 'suspend', { suspend: !selectedTenant.isSuspended })}
                      className={`px-3 py-1.5 font-semibold rounded-lg shadow text-xs ${selectedTenant.isSuspended ? 'bg-yellow-500 text-white' : 'bg-red-600 text-white'}`}
                    >
                      {selectedTenant.isSuspended ? '🔓 Odblokuj' : '🚫 Zawieś'}
                    </button>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        const msg = window.prompt("Wpisz treść wiadomości SMS do właściciela firmy:");
                        if (msg) handleAction(selectedTenant.id, "sms", { message: msg });
                      }}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow text-xs"
                    >
                      ✉️ Wyślij SMS
                    </button>
                  </div>
                </div>

                {selectedTenant.riskLevel === 'HIGH' && selectedTenant.moderationNotes && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r">
                    <h3 className="font-bold text-red-700 text-sm">🚨 Powód Oflagowania przez AI:</h3>
                    <p className="text-red-600 text-xs mt-1">{selectedTenant.moderationNotes}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                  {/* Sekcja Profilu Biznesowego */}
                  <div className="border rounded-xl p-4 bg-gray-50 flex flex-col max-h-[350px]">
                    <h3 className="font-bold text-sm mb-2 text-gray-700">Profil Biznesowy (Instrukcje Główne)</h3>
                    <div className="whitespace-pre-wrap text-xs bg-white p-3 rounded-lg border font-mono text-gray-800 overflow-y-auto flex-1">
                      {selectedTenant.businessProfile === 'facility' ? 'Placówka / Obiekt (Domyślny)' : selectedTenant.businessProfile}
                    </div>
                  </div>

                  {/* Sekcja FAQ */}
                  <div className="border rounded-xl p-4 bg-gray-50 flex flex-col max-h-[350px]">
                    <h3 className="font-bold text-sm mb-2 text-gray-700">Baza Wiedzy (FAQ)</h3>
                    <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
                      {selectedTenant.faqEntries?.map((f: any) => (
                        <div key={f.id} className="bg-white p-3 rounded-lg border text-xs">
                          <div className="font-semibold text-indigo-700 mb-1">Q: {f.question}</div>
                          <div className="text-gray-700">A: {f.answer}</div>
                        </div>
                      ))}
                      {(!selectedTenant.faqEntries || selectedTenant.faqEntries.length === 0) && (
                        <div className="text-gray-400 italic text-center p-4 text-xs">Brak wpisów FAQ</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Narzędzia Subskrypcji */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-bold text-base mb-3 text-gray-800">⚙️ Zarządzanie Abonamentem</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-blue-50 p-4 rounded-xl">
                    <div className="text-xs">
                      <div>Obecny plan: <strong className="uppercase">{selectedTenant.subscription?.planName || 'Brak'}</strong></div>
                      <div className="mt-1">
                        Status: <span className={`font-bold uppercase ${selectedTenant.subscription?.status === 'paused' ? 'text-amber-600' : selectedTenant.subscription?.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                          {selectedTenant.subscription?.status || 'none'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto w-full sm:w-auto">
                      <button 
                        onClick={() => handleAction(selectedTenant.id, 'adjust-minutes', { additionalMinutes: 100 })}
                        className="px-3 py-1 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-100 font-medium text-xs"
                      >
                        +100 Minut
                      </button>
                      <button 
                        onClick={() => handleAction(selectedTenant.id, 'adjust-minutes', { additionalMinutes: -100 })}
                        className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded hover:bg-red-100 font-medium text-xs"
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
    </div>
  );
}
