const fs = require('fs');
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

code = code.replace(
  "const [botName, setBotName] = useState('Ewa');",
  "const [botName, setBotName] = useState('Ewa');\n  const [reviewLink, setReviewLink] = useState('');"
);

code = code.replace(
  "setBotName(data.botName || 'Ewa');",
  "setBotName(data.botName || 'Ewa');\n        setReviewLink(data.reviewLink || '');"
);

code = code.replace(
  "botName,\n        toneOfVoice",
  "botName,\n        toneOfVoice,\n        reviewLink"
);

const searchInput = `                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Nazwa wirtualnego asystenta (dla AI)
                  </label>
                  <input type="text" value={botName} onChange={e => setBotName(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-gold-500" />
                </div>`;
                
const replaceInput = `                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Nazwa wirtualnego asystenta (dla AI)
                  </label>
                  <input type="text" value={botName} onChange={e => setBotName(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-gold-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Link do wizytówki (Opinie Google dla ankiet)
                  </label>
                  <input type="text" placeholder="https://g.page/r/twoja-firma/review" value={reviewLink} onChange={e => setReviewLink(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-gold-500" />
                </div>`;
                
code = code.replace(searchInput, replaceInput);

fs.writeFileSync('src/components/Settings.tsx', code, 'utf8');
