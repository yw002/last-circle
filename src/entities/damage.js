// Damage calculation utility

export function calcDamage(baseDmg, isHeadshot, targetObj) {
  let dmg = baseDmg;
  if (isHeadshot) {
    dmg *= 2.5;
    if (targetObj.helmet) dmg *= (1 - targetObj.helmet.reduction);
  } else {
    if (targetObj.armor) dmg *= (1 - targetObj.armor.reduction);
  }
  return dmg;
}
