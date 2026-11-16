import type { PersonalityType } from '../protocol/types.ts';

export const FROG_RELATION_LABELS = {
  fakeFriend: '跟你假玩背后捅刀子的是....',
  confidant: '跟你心连心的是....'
} as const;

/** 固定的角色整活配对，不是人格相容性或现实朋友关系预测；不参与计分。 */
export function getFrogRelations(code: string, personas: PersonalityType[]) {
  if (!/^[IE][NS][TF][JP]$/.test(code)) return null;
  const opposite: Record<string, string> = { I: 'E', E: 'I', N: 'S', S: 'N', T: 'F', F: 'T', J: 'P', P: 'J' };
  const flip = (mask: number) => Array.from(code, (letter, index) => mask & (1 << index) ? opposite[letter] : letter).join('');
  const select = (masks: number[]) => masks.map(mask => personas.find(persona => persona.id === flip(mask)));
  // 两种明显反差与两种单轴变化，四只各不相同；首位沿用原配对，保持既有调用兼容。
  const fake = select([15, 14]);
  const friends = select([1, 2]);
  if ([...fake, ...friends].some(persona => !persona)) return null;
  const fakeFriends = fake as PersonalityType[];
  const confidants = friends as PersonalityType[];
  return { fakeFriend: fakeFriends[0], confidant: confidants[0], fakeFriends, confidants };
}
