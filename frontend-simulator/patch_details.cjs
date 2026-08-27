const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');

const searchDetails = `!isEditing && selectedAppt.id !== 'new' ? (
              <div className="space-y-4">
                <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 space-y-3">
                  <div className="flex items-center gap-3 text-surface-800">
                    <User className="w-4 h-4 text-surface-400" />
                    <span className="font-medium">{selectedAppt.customerName}</span>
                  </div>`;

const replaceDetails = `!isEditing && selectedAppt.id !== 'new' ? (
              <div className="space-y-4">
                {(selectedAppt.status === 'confirmed_by_client' || selectedAppt.promoCode) && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200 space-y-2 mb-4">
                    {selectedAppt.status === 'confirmed_by_client' && (
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Potwierdzone przez klienta (SMS/Głos)
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
                <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 space-y-3">
                  <div className="flex items-center gap-3 text-surface-800">
                    <User className="w-4 h-4 text-surface-400" />
                    <span className="font-medium">{selectedAppt.customerName}</span>
                  </div>`;

code = code.replace(searchDetails, replaceDetails);

fs.writeFileSync('src/components/Appointments.tsx', code, 'utf8');
