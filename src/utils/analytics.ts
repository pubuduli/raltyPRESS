export function calculateEngagementRate(reactions: number, comments: number, shares: number, reach: number): number {
  if (!reach || reach <= 0) return 0;
  const rate = ((reactions + comments + shares) / reach) * 100;
  return Number(rate.toFixed(2));
}

export function calculateFollowerGrowthRate(netNewFollowers: number, startingFollowers: number): number {
  if (!startingFollowers || startingFollowers <= 0) return 0;
  const rate = (netNewFollowers / startingFollowers) * 100;
  return Number(rate.toFixed(2));
}

export function calculateShareRate(shares: number, reach: number): number {
  if (!reach || reach <= 0) return 0;
  const rate = (shares / reach) * 100;
  return Number(rate.toFixed(2));
}
