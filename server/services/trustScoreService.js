function updateTrustScore(previousAverage, tripCount, newRating) {
  return (previousAverage * tripCount + newRating) / (tripCount + 1);
}

module.exports = { updateTrustScore };
