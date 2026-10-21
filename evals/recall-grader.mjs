export function gradeRecall(answer, expected) {
  let parsed;
  try { parsed = JSON.parse(answer.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()); }
  catch { return { exact: 0, passed: false, validJson: false }; }
  const exact = Object.entries(expected).filter(([key, value]) => parsed?.[key] === value).length;
  return { exact, passed: exact === Object.keys(expected).length && Object.keys(parsed).length === Object.keys(expected).length, validJson: true };
}
