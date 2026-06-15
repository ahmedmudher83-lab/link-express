import { Stethoscope, UserRound, CalendarDays, User, CheckCircle } from 'lucide-react';

interface ProgressStepperProps {
  currentStep: number;
}

const steps = [
  { label: 'التخصص', icon: Stethoscope },
  { label: 'الطبيب', icon: UserRound },
  { label: 'الموعد', icon: CalendarDays },
  { label: 'البيانات', icon: User },
  { label: 'التأكيد', icon: CheckCircle },
];

export default function ProgressStepper({ currentStep }: ProgressStepperProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between max-w-3xl mx-auto relative">
        {/* Progress Line Background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-0" />
        
        {/* Active Progress Line */}
        <div 
          className="absolute top-5 left-0 h-0.5 bg-teal-600 transition-all duration-500 -z-0"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const Icon = step.icon;

          return (
            <div key={index} className="flex flex-col items-center z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-200'
                    : isCurrent
                    ? 'bg-teal-100 text-teal-700 border-2 border-teal-600 ring-4 ring-teal-100'
                    : 'bg-white text-gray-400 border-2 border-gray-200'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-xs mt-2 font-medium transition-colors ${
                  isCompleted || isCurrent ? 'text-teal-700' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
