import { useState, useEffect } from 'react';

const thinkingStages = [
  { text: "Analyzing your question...", icon: "fas fa-search", duration: 2000 },
  { text: "Searching treatment database...", icon: "fas fa-database", duration: 3000 },
  { text: "Processing with AI...", icon: "fas fa-brain", duration: 4000 },
  { text: "Generating response...", icon: "fas fa-edit", duration: 2000 },
];

export default function ThinkingIndicator() {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stage = thinkingStages[currentStage];
    if (!stage) return;

    // Reset progress for new stage
    setProgress(0);
    
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + (100 / (stage.duration / 50)); // Update every 50ms
      });
    }, 50);

    // Move to next stage
    const stageTimeout = setTimeout(() => {
      if (currentStage < thinkingStages.length - 1) {
        setCurrentStage(prev => prev + 1);
      }
    }, stage.duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stageTimeout);
    };
  }, [currentStage]);

  return (
    <div className="flex items-start space-x-3" data-testid="thinking-indicator">
      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 mt-1 animate-pulse">
        <i className="fas fa-robot text-primary-foreground text-sm"></i>
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-4 shadow-sm min-w-0 flex-1">
        <div className="space-y-3">
          {/* Current thinking stage */}
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
              <i className={`${thinkingStages[currentStage]?.icon} text-primary text-xs animate-spin`}></i>
            </div>
            <span className="text-sm font-medium text-foreground">
              {thinkingStages[currentStage]?.text}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-75 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {currentStage + 1} of {thinkingStages.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Stage indicators */}
          <div className="flex items-center space-x-2">
            {thinkingStages.map((stage, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  index < currentStage 
                    ? 'bg-primary' 
                    : index === currentStage 
                    ? 'bg-primary animate-pulse' 
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Subtle breathing animation */}
          <div className="flex items-center space-x-1 pt-1">
            <div className="typing-indicator">
              <div className="typing-dot bg-primary/40"></div>
              <div className="typing-dot bg-primary/40"></div>
              <div className="typing-dot bg-primary/40"></div>
            </div>
            <span className="text-xs text-muted-foreground ml-2">Deep thinking...</span>
          </div>
        </div>
      </div>
    </div>
  );
}