import React, { useState, useEffect } from 'react';

export function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authPin, setAuthPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Nowe stany do wyszukiwania i sortowania
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('riskDesc');
  
  // Stan do przełączania widoków na urządzeniach mobilnych
  const [showListOnMobile, setShowListOnMobile] = useState(true);

  useEffect(() => {
    if (isAuthenticated) fetchTenants();
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

  const fetchTenantDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tenants/${id}`);
      if (res.ok) {
        setSelectedTenant(await res.json());
        setShowListOnMobile(false); // Ukryj listę na mobile, pokaż szczegóły
      }
    } catch (e) {
      console.error(e);
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
          <h2 className="text-2xl font-bold mb-4 text-red-600">Super Admin</h2>
          <input 
            type="password" 
            placeholder="Wprowadź kod PIN" 
            className="w-full border p-2 rounded mb-4"
            value={authPin}
            onChange={e => setAuthPin(e.target.value)}
          />
          <button 
            className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700"
            onClick={() => { if (authPin === '7777') setIsAuthenticated(true); else alert('Błędny PIN'); }}
          >
            Zaloguj
          </button>
        </div>
      </div>
    );
  }

  // Filtrowanie i sortowanie listy
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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* LSB: Lista Tenantów */}
      <div className={`w-full md:w-1/3 border-r bg-white flex flex-col h-screen overflow-hidden ${!showListOnMobile ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 bg-gray-800 text-white font-bold text-xl flex justify-between items-center shrink-0">
          <span>🛡️ Bezpieczeństwo AI</span>
          <span className="text-sm font-normal">Klienci: {filteredTenants.length}</span>
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
                <strong className="text-lg">{t.name}</strong>
                {t.riskLevel === 'HIGH' && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-bold animate-pulse">HIGH RISK</span>}
                {t.riskLevel === 'LOW' && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">LOW</span>}
              </div>
              <div className="text-sm text-gray-500">📞 {t.phoneNumber} {t.contactEmail && <span className="ml-2 text-gray-400">| ✉️ {t.contactEmail}</span>}</div>
              <div className="text-xs text-gray-400 mt-1 flex justify-between items-center">
                <span>Minuty: {t.subscription?.minutesUsed || 0} / {t.subscription?.minutesIncluded || 0}</span>
                <div className="flex gap-1">
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
      <div className={`w-full md:w-2/3 h-screen overflow-y-auto p-4 md:p-6 bg-gray-50 ${showListOnMobile ? 'hidden md:block' : 'block'}`}>
        {!selectedTenant ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-xl hidden md:flex">
            Wybierz firmę z listy po lewej
          </div>
        ) : (
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm">
            <button 
              onClick={() => setShowListOnMobile(true)}
              className="md:hidden mb-4 text-blue-600 font-semibold flex items-center gap-1"
            >
              ← Powrót do listy
            </button>

            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold break-words">{selectedTenant.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  {selectedTenant.isSuspended ? (
                    <span className="bg-red-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">🚫 Konto Zawieszone (Blokada AI)</span>
                  ) : (
                    <span className="bg-green-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">✅ Konto Aktywne</span>
                  )}
                  {selectedTenant.subscription?.status === 'paused' && (
                    <span className="bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-bold">⏸️ Abonament Wstrzymany</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button 
                  onClick={() => handleAction(selectedTenant.id, 'approve')}
                  className="px-4 py-3 sm:py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded shadow transition text-sm sm:text-base text-center"
                >
                  ✅ Bezpieczny (Approve)
                </button>
                <button 
                  onClick={() => handleAction(selectedTenant.id, 'suspend', { suspend: !selectedTenant.isSuspended })}
                  className={`px-4 py-3 sm:py-2 font-semibold rounded shadow transition text-sm sm:text-base text-center ${selectedTenant.isSuspended ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                >
                  {selectedTenant.isSuspended ? '🔓 Odblokuj Konto' : '🚫 Zawieś Konto'}
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    const msg = window.prompt("Wpisz treść wiadomości SMS do właściciela firmy:");
                    if (msg) handleAction(selectedTenant.id, "sms", { message: msg });
                  }}
                  className="px-4 py-3 sm:py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded shadow transition text-sm sm:text-base text-center"
                >
                  ✉️ Wyślij SMS
                </button>
              </div>
            </div>

            {selectedTenant.riskLevel === 'HIGH' && selectedTenant.moderationNotes && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <h3 className="font-bold text-red-700">🚨 Powód Oflagowania przez AI:</h3>
                <p className="text-red-600 mt-1">{selectedTenant.moderationNotes}</p>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              {/* Sekcja Profilu Biznesowego */}
              <div className="border rounded-lg p-4 bg-gray-50 flex flex-col max-h-[500px]">
                <h3 className="font-bold text-lg mb-2 text-gray-700">Profil Biznesowy (Instrukcje Główne)</h3>
                <div className="whitespace-pre-wrap text-sm bg-white p-3 rounded border font-mono text-gray-800 overflow-y-auto flex-1">
                  {selectedTenant.businessProfile === 'facility' ? 'Placówka / Obiekt (Domyślny)' : selectedTenant.businessProfile}
                </div>
              </div>

              {/* Sekcja FAQ */}
              <div className="border rounded-lg p-4 bg-gray-50 flex flex-col max-h-[500px]">
                <h3 className="font-bold text-lg mb-2 text-gray-700">Baza Wiedzy (FAQ)</h3>
                <div className="flex flex-col gap-3 overflow-y-auto pr-2 flex-1">
                  {selectedTenant.faqEntries?.map((f: any) => (
                    <div key={f.id} className="bg-white p-3 rounded border text-sm">
                      <div className="font-semibold text-indigo-700 mb-1">Q: {f.question}</div>
                      <div className="text-gray-700">A: {f.answer}</div>
                    </div>
                  ))}
                  {(!selectedTenant.faqEntries || selectedTenant.faqEntries.length === 0) && (
                    <div className="text-gray-400 italic text-center p-4">Brak wpisów FAQ</div>
                  )}
                </div>
              </div>
            </div>

            {/* Narzędzia Subskrypcji */}
            <div className="border-t pt-6 mt-6">
              <h3 className="font-bold text-xl mb-4 text-gray-800">⚙️ Zarządzanie Abonamentem</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-blue-50 p-4 rounded-lg">
                <div className="text-sm">
                  <div>Obecny plan: <strong className="uppercase">{selectedTenant.subscription?.planName || 'Brak'}</strong></div>
                  <div className="mt-1">
                    Status: <span className={`font-bold uppercase ${selectedTenant.subscription?.status === 'paused' ? 'text-amber-600' : selectedTenant.subscription?.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                      {selectedTenant.subscription?.status || 'none'}
                    </span>
                    {selectedTenant.subscription?.pausedUntil && (
                      <span className="text-xs text-gray-500 ml-2">
                        (do {new Date(selectedTenant.subscription.pausedUntil).toLocaleDateString('pl-PL')})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto w-full sm:w-auto">
                  {selectedTenant.subscription?.status === 'paused' ? (
                    <button 
                      onClick={() => handleAction(selectedTenant.id, 'subscription/status', { status: 'active' })}
                      className="px-3 py-2 sm:py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium text-sm"
                    >
                      ▶️ Wznów Subskrypcję
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleAction(selectedTenant.id, 'subscription/status', { status: 'paused' })}
                      className="px-3 py-2 sm:py-1 bg-amber-500 text-white rounded hover:bg-amber-600 font-medium text-sm"
                    >
                      ⏸️ Zawieś na 30 dni
                    </button>
                  )}
                  <button 
                    onClick={() => handleAction(selectedTenant.id, 'adjust-minutes', { additionalMinutes: 100 })}
                    className="px-3 py-2 sm:py-1 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-100 font-medium text-sm"
                  >
                    +100 Minut
                  </button>
                  <button 
                    onClick={() => handleAction(selectedTenant.id, 'adjust-minutes', { additionalMinutes: -100 })}
                    className="px-3 py-2 sm:py-1 bg-white border border-red-300 text-red-700 rounded hover:bg-red-100 font-medium text-sm"
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
  );
}
