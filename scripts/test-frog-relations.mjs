import assert from 'node:assert/strict';
import { naifrogTest } from '../src/instance/naifrogTest.ts';
import { getFrogRelations } from '../src/core/frogRelations.ts';
import { wrapPosterText } from '../src/core/resultPoster.ts';

const before = structuredClone(naifrogTest.personalityTypes);
for (const persona of naifrogTest.personalityTypes) {
  const related = getFrogRelations(persona.id, naifrogTest.personalityTypes);
  assert.ok(related);
  assert.equal(related.fakeFriends.length, 2);
  assert.equal(related.confidants.length, 2);
  assert.equal(new Set([...related.fakeFriends, ...related.confidants].map(p => p.id)).size, 4);
  for (const key of ['fakeFriends', 'confidants']) {
    for (const other of related[key]) {
      assert.notEqual(other.id, persona.id);
      assert.ok(getFrogRelations(other.id, before)[key].some(p => p.id === persona.id));
    }
  }
  assert.notEqual(related.fakeFriend.id, persona.id);
  assert.notEqual(related.confidant.id, persona.id);
  assert.notEqual(related.confidant.id, related.fakeFriend.id);
  assert.equal(getFrogRelations(related.fakeFriend.id, naifrogTest.personalityTypes).fakeFriend.id, persona.id);
  assert.equal(getFrogRelations(related.confidant.id, naifrogTest.personalityTypes).confidant.id, persona.id);
  assert.deepEqual(getFrogRelations(persona.id, naifrogTest.personalityTypes), related);
}
assert.deepEqual(naifrogTest.personalityTypes, before);
assert.equal(getFrogRelations('XXXX', before), null);
assert.equal(getFrogRelations('unknown', before), null);
assert.equal(getFrogRelations('INTJ', []), null);
for (const text of ['奶蛙你好，今天开心吗？', 'Dr.奶和奶sir', '开心🐸，继续看看', '第一行\n第二行']) {
  const lines = wrapPosterText(text, 5, value => Array.from(value).length);
  assert.ok(lines.every(line => Array.from(line).length <= 5));
  assert.equal(lines.join(''), text.replaceAll('\n', ''));
}
assert.throws(() => wrapPosterText('你好', 0, value => value.length), /无效/);
console.log('PASS: 16种配对固定、对称且不指向自身，缺失配置安全，海报换行不丢字符。');
