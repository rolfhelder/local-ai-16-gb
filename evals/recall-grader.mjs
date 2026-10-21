export function gradeRecall(answer, expected) {
  let parsed;
  try { parsed = JSON.parse(answer.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()); }
  catch { return { exact: 0, passed: false, validJson: false }; }
  const exact = Object.entries(expected).filter(([key, value]) => parsed?.[key] === value).length;
  return { exact, passed: exact === Object.keys(expected).length && Object.keys(parsed).length === Object.keys(expected).length, validJson: true };
}
// Diagnostic only: distinguish wrong lookup values from prose around valid JSON.
// Never changes the strict task score or searches for the expected answer in thought.
export function diagnoseRecall(answer, expected) {
  const strict=gradeRecall(answer,expected);
  const candidate=answer.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]??answer.match(/\{[^{}]*\}/)?.[0];
  const recovered=strict.validJson?strict:candidate?gradeRecall(candidate,expected):{exact:0,passed:false,validJson:false};
  return {strict,diagnosticJsonExact:recovered.exact,diagnosticJsonPassed:recovered.passed,formatOnlyFailure:!strict.passed&&recovered.passed,diagnosticCredit:false};
}
