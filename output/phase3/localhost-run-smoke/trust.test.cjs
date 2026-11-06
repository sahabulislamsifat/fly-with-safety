const {test}=require('node:test'),a=require('node:assert/strict'),{keyLine,discover}=require('./trust.cjs');
test('TOFU accepts one explicit ed25519 key, not banner',()=>a.equal(keyLine('# note\nlocalhost.run ssh-ed25519 AAAAC3Nza\n'),'localhost.run ssh-ed25519 AAAAC3Nza\n'));
test('no silent key replacement/ambiguous identity',()=>{for(const s of ['', 'evil.invalid ssh-ed25519 AAAA','localhost.run ssh-rsa AAAA','localhost.run ssh-ed25519 AAAA\nlocalhost.run ssh-ed25519 BBBB'])a.throws(()=>keyLine(s));});
test('only service origin from owned output',()=>{a.equal(discover('https://localhost.run/docs https://abc.lhr.life'), 'https://abc.lhr.life');a.equal(discover('https://evil.invalid'),null);});
