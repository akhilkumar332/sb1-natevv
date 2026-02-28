export type OnboardingValidationRule<TFormData extends object> = {
  step: number;
  message: string;
  required?: Array<Extract<keyof TFormData, string>>;
  custom?: (data: TFormData) => boolean;
};

const isPresent = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return value;
  return value !== null && value !== undefined;
};

export const validateOnboardingStep = <TFormData extends object>(options: {
  step: number;
  data: TFormData;
  rules: Array<OnboardingValidationRule<TFormData>>;
  onError: (message: string) => void;
}): boolean => {
  const stepRules = options.rules.filter((rule) => rule.step === options.step);
  for (const rule of stepRules) {
    const requiredMissing = rule.required?.some((field) => !isPresent(options.data[field as keyof TFormData]));
    const customInvalid = rule.custom ? !rule.custom(options.data) : false;
    if (requiredMissing || customInvalid) {
      options.onError(rule.message);
      return false;
    }
  }
  return true;
};
