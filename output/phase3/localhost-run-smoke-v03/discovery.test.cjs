const {test}=require('node:test'),a=require('node:assert/strict'),{endpoint,inspectLine,reader}=require('./discovery.cjs');
test('actual bad selected admin URL is never endpoint',()=>a.equal(endpoint('https://admin.localhost.run'),null));
test('help/login banner cannot trigger readiness',()=>{a.equal(inspectLine('Permission denied? Visit https://admin.localhost.run'),null);a.equal(inspectLine('See https://abc.lhr.life for documentation'),null);});
test('labelled TLS allocation recognised, not banner URL',()=>a.equal(inspectLine('abc.lhr.life tunneled with tls termination, https://abc.lhr.life'),'https://abc.lhr.life'));
test('typed allocation record recognised',()=>a.equal(inspectLine(JSON.stringify({event:'tunnel allocated',url:'https://abc.lhr.life'})),'https://abc.lhr.life'));
test('JSON help message ignored',()=>a.equal(inspectLine(JSON.stringify({event:'help',url:'https://abc.lhr.life'})),null));
test('complete lines required across stream chunks',()=>{const r=reader();a.deepEqual(r('abc.lhr.life tunneled with tls termination, https://abc.lhr.'),[]);a.deepEqual(r('life\n'),['https://abc.lhr.life']);});
test('ambiguous allocation fails closed',()=>a.throws(()=>inspectLine('tunnel ready https://a.lhr.life https://b.lhr.life')));
test('unknown schema safely remains pending',()=>a.equal(inspectLine('{"newSchema":"https://abc.lhr.life"}'),null));
