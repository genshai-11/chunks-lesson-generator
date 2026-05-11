const fs = require('fs');
let c = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');

c = c.replace(/<\/div>\n                    <\/div>\n                  <\/div>\n                <\/div>\n              <\/div>\n            <\/div>\n          <\/div>\n        \)}/,
`                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}`);

fs.writeFileSync('src/components/SettingsTab.tsx', c);
