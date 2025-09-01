"use client"

import { useState, useEffect } from "react"

const deepThinkingStages = [
  { text: "Analyzing complex query...", icon: "fas fa-brain", duration: 3000 },
  { text: "Searching comprehensive data...", icon: "fas fa-search-plus", duration: 4000 },
  { text: "Cross-referencing information...", icon: "fas fa-project-diagram", duration: 3500 },
  { text: "Deep processing with AI...", icon: "fas fa-microchip", duration: 4500 },
  { text: "Formulating detailed response...", icon: "fas fa-cogs", duration: 3000 },
]

export default function DeepThinkingIndicator() {
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const stage = deepThinkingStages[currentStage]
    if (!stage) return

    setProgress(0)

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 100 / (stage.duration / 50)
      })
    }, 50)

    const stageTimeout = setTimeout(() => {
      if (currentStage < deepThinkingStages.length - 1) {
        setCurrentStage((prev) => prev + 1)
      }
    }, stage.duration)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(stageTimeout)
    }
  }, [currentStage])

  return (
    <div className="flex items-start space-x-4 animate-in slide-in-from-left-4 duration-500">
      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1 shadow-lg animate-pulse">
        <i className="fas fa-brain text-white text-sm"></i>
      </div>
      <div className="flex-1 max-w-3xl">
        <div className="bg-gradient-to-r from-purple-50/90 to-indigo-50/90 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200/50 dark:border-purple-700/50 rounded-3xl rounded-tl-lg px-6 py-5 shadow-lg backdrop-blur-sm">
          <div className="space-y-4">
            {/* Current thinking stage */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <i className={`${deepThinkingStages[currentStage]?.icon} text-white text-sm animate-spin`}></i>
              </div>
              <span className="text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                {deepThinkingStages[currentStage]?.text}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-3">
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-75 ease-out shadow-sm"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-medium">
                <span>Deep Analysis - Step {currentStage + 1} of {deepThinkingStages.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Stage indicators */}
            <div className="flex items-center justify-center space-x-3">
              {deepThinkingStages.map((stage, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    index < currentStage 
                      ? "bg-gradient-to-r from-purple-500 to-indigo-600 scale-110" 
                      : index === currentStage 
                        ? "bg-gradient-to-r from-purple-500 to-indigo-600 animate-pulse scale-125" 
                        : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
              ))}
            </div>

            {/* Deep thinking animation */}
            <div className="flex items-center justify-center space-x-2 pt-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
              <span className="text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent ml-3">
                🧠 Deep Thinking Mode
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}