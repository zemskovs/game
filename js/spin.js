(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ButtleSpin = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function seatAngle(index, count) {
    return (360 / count) * index;
  }

  function seatPoint(index, count, radius) {
    const angle = seatAngle(index, count) * Math.PI / 180;
    return {
      x: radius * Math.sin(angle),
      y: -radius * Math.cos(angle),
    };
  }

  function nextPlayerIndex(count, lastIndex, random) {
    const blocked = count >= 3 && Number.isInteger(lastIndex) && lastIndex >= 0 && lastIndex < count;
    if (!blocked) return Math.floor(random() * count);
    const choice = Math.floor(random() * (count - 1));
    return choice >= lastIndex ? choice + 1 : choice;
  }

  function bottleRotation(currentRotation, targetAngle) {
    const currentMod = ((currentRotation % 360) + 360) % 360;
    let delta = targetAngle - currentMod;
    if (delta < 0) delta += 360;
    return currentRotation + 5 * 360 + delta;
  }

  return {
    seatAngle: seatAngle,
    seatPoint: seatPoint,
    nextPlayerIndex: nextPlayerIndex,
    bottleRotation: bottleRotation,
  };
});
