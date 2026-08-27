const fs = require('fs');
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

const search = `                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Nazwa wirtualnego asystenta
                  </label>
                  <input
                    type="text"
                    value={formData.botName}
                    onChange={(e) => setFormData({ ...formData, botName: e.target.value })}
                    className="w-full bg-white border border-surface-200 rounded-xl px-4 py-2 text-surface-900 focus:ring-2 focus:ring-gold-500"
                  />
                </div>`;
                
const replace = `                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Nazwa wirtualnego asystenta
                  </label>
                  <input
                    type="text"
                    value={formData.botName}
                    onChange={(e) => setFormData({ ...formData, botName: e.target.value })}
                    className="w-full bg-white border border-surface-200 rounded-xl px-4 py-2 text-surface-900 focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Link do opinii Google (dla ankiet NPS)
                  </label>
                  <input
                    type="text"
                    placeholder="np. https://g.page/r/twoja-firma/review"
                    value={formData.reviewLink || ''}
                    onChange={(e) => setFormData({ ...formData, reviewLink: e.target.value })}
                    className="w-full bg-white border border-surface-200 rounded-xl px-4 py-2 text-surface-900 focus:ring-2 focus:ring-gold-500"
                  />
                </div>`;

code = code.replace(search, replace);
fs.writeFileSync('src/components/Settings.tsx', code, 'utf8');
