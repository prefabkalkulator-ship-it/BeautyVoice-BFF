const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');

const searchForm = `            <form onSubmit={saveAppointment} className="p-6 space-y-5">
              <div className="space-y-4">`;

const replaceForm = `            <form onSubmit={saveAppointment} className="p-6 space-y-5">
              {(selectedAppt?.status === 'confirmed_by_client' || selectedAppt?.promoCode) && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200 space-y-2 mb-4">
                  {selectedAppt?.status === 'confirmed_by_client' && (
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Potwierdzone przez klienta (SMS/Głos)
                    </div>
                  )}
                  {selectedAppt?.promoCode && (
                    <div className="flex items-center gap-2 text-amber-700 font-medium">
                      <Gift className="w-5 h-5 text-amber-600" />
                      Użyty rabat: {selectedAppt.promoCode}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-4">`;

code = code.replace(searchForm, replaceForm);

fs.writeFileSync('src/components/AppointmentsDaily.tsx', code, 'utf8');
