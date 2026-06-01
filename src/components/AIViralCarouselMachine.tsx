'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Image as ImageIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Wand2,
  X,
  ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

// Types for the carousel plan
interface CarouselSlide {
  slide_number: number;
  slide_type: string;
  image_prompt: string;
  header_text: string | null;
  body_text: string | null;
  text_position: 'top' | 'center' | 'bottom';
}

interface CarouselPlan {
  carousel_title: string;
  slides: CarouselSlide[];
}

interface GeneratedSlide extends CarouselSlide {
  imageData?: string;
  isLoading?: boolean;
  error?: string;
}

type GenerationStep = 'idle' | 'planning' | 'generating' | 'complete' | 'error';

const SLIDE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  hook: { label: 'HOOK', color: 'bg-amber-500' },
  value: { label: 'VALUE', color: 'bg-emerald-500' },
  objection_crusher: { label: 'OBJECTION', color: 'bg-rose-500' },
  social_proof: { label: 'SOCIAL PROOF', color: 'bg-blue-500' },
  urgency: { label: 'URGENCY', color: 'bg-orange-500' },
  cta: { label: 'CTA', color: 'bg-purple-500' },
};

export default function AIViralCarouselMachine() {
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<GenerationStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<GeneratedSlide[]>([]);
  const [carouselTitle, setCarouselTitle] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const [zoomedSlide, setZoomedSlide] = useState<number | null>(null);
  const abortRef = useRef<boolean>(false);

  const generateCarousel = useCallback(async () => {
    if (!description.trim()) return;

    abortRef.current = false;
    setStep('planning');
    setError(null);
    setSlides([]);
    setCarouselTitle('');
    setCurrentSlide(0);
    setProgress(0);

    try {
      // Step 1: Generate the carousel plan
      const planResponse = await fetch('/api/carousel/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!planResponse.ok) {
        const errData = await planResponse.json();
        throw new Error(errData.error || 'Failed to generate carousel plan');
      }

      const planData = await planResponse.json();
      const plan: CarouselPlan = planData.plan;

      if (!plan.slides || plan.slides.length === 0) {
        throw new Error('No slides generated in the plan');
      }

      setCarouselTitle(plan.carousel_title);
      setProgress(20);

      // Initialize slides with loading state
      const initialSlides: GeneratedSlide[] = plan.slides.map((slide) => ({
        ...slide,
        isLoading: true,
        imageData: undefined,
        error: undefined,
      }));

      setSlides(initialSlides);
      setStep('generating');

      // Step 2: Generate images for each slide one by one
      const totalSlides = plan.slides.length;
      let completedSlides = 0;

      for (let i = 0; i < plan.slides.length; i++) {
        if (abortRef.current) {
          setStep('error');
          setError('Generation cancelled');
          return;
        }

        const slide = plan.slides[i];

        try {
          const imageResponse = await fetch('/api/carousel/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_prompt: slide.image_prompt }),
          });

          if (!imageResponse.ok) {
            const errData = await imageResponse.json();
            throw new Error(errData.error || `Failed to generate image for slide ${i + 1}`);
          }

          const imageData = await imageResponse.json();

          setSlides((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, isLoading: false, imageData: imageData.image }
                : s
            )
          );
        } catch (imgError: unknown) {
          const message = imgError instanceof Error ? imgError.message : 'Image generation failed';
          setSlides((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, isLoading: false, error: message }
                : s
            )
          );
        }

        completedSlides++;
        setProgress(20 + Math.round((completedSlides / totalSlides) * 80));
      }

      setProgress(100);
      setStep('complete');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      setStep('error');
    }
  }, [description]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
  }, []);

  const resetAll = useCallback(() => {
    setStep('idle');
    setError(null);
    setSlides([]);
    setCarouselTitle('');
    setCurrentSlide(0);
    setProgress(0);
    setDescription('');
  }, []);

  const downloadSlide = useCallback(
    (slideIndex: number) => {
      const slide = slides[slideIndex];
      if (!slide?.imageData) return;

      const link = document.createElement('a');
      link.href = slide.imageData;
      link.download = `${carouselTitle || 'carousel'}-slide-${slide.slide_number}.png`;
      link.click();
    },
    [slides, carouselTitle]
  );

  const downloadAllSlides = useCallback(() => {
    slides.forEach((slide, index) => {
      if (slide.imageData) {
        setTimeout(() => downloadSlide(index), index * 300);
      }
    });
  }, [slides, downloadSlide]);

  const renderTextOverlay = (slide: GeneratedSlide) => {
    const hasHeader = slide.header_text && slide.header_text.trim() !== '';
    const hasBody = slide.body_text && slide.body_text.trim() !== '';

    if (!hasHeader && !hasBody) return null;

    const positionClasses = {
      top: 'justify-start pt-8',
      center: 'justify-center',
      bottom: 'justify-end pb-8',
    };

    return (
      <div
        className={`absolute inset-0 flex flex-col items-center ${positionClasses[slide.text_position || 'center']} px-6 z-10`}
      >
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-4 max-w-[90%] text-center">
          {hasHeader && (
            <h3 className="text-white font-bold text-lg md:text-xl leading-tight drop-shadow-lg">
              {slide.header_text}
            </h3>
          )}
          {hasHeader && hasBody && <div className="h-2" />}
          {hasBody && (
            <p className="text-white/90 text-sm md:text-base leading-relaxed drop-shadow-md">
              {slide.body_text}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderSlidePreview = (slide: GeneratedSlide, index: number, size: 'small' | 'large' = 'small') => {
    const isSmall = size === 'small';

    return (
      <div
        key={index}
        className={`relative overflow-hidden rounded-xl bg-muted ${
          isSmall ? 'w-20 h-36 md:w-24 md:h-42' : 'w-full aspect-[9/16]'
        } cursor-pointer group`}
        onClick={() => {
          if (isSmall) setCurrentSlide(index);
        }}
      >
        {slide.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : slide.error ? (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
        ) : slide.imageData ? (
          <>
            <img
              src={slide.imageData}
              alt={`Slide ${slide.slide_number}`}
              className="w-full h-full object-cover"
            />
            {isSmall && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <ZoomIn className="w-5 h-5 text-white" />
              </div>
            )}
          </>
        ) : null}

        {/* Slide type badge */}
        {isSmall && (
          <div className="absolute top-1 left-1">
            <span className="text-[8px] px-1 py-0.5 rounded-full text-white font-medium bg-black/50">
              {slide.slide_number}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                AI Viral Carousel Machine
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                BOFU Carousel Generator — 9:16 Vertical
              </p>
            </div>
          </div>
          {step === 'complete' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadAllSlides}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Download className="w-4 h-4 mr-1" />
                Download All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAll}
                className="border-white/20 text-white hover:bg-white/10"
              >
                New Carousel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Input Section */}
        {step === 'idle' || step === 'error' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <Wand2 className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-white">
                  Describe Your Product or Service
                </h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Write a description of your product or service. The AI will generate a complete viral carousel plan with 6-8 slides targeting ready-to-buy customers.
              </p>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. A smart fitness tracker that monitors your sleep, heart rate, and daily activity with 14-day battery life..."
                className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-amber-500/25 resize-none"
                disabled={step === 'planning'}
              />
              {error && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
              <Button
                onClick={generateCarousel}
                disabled={!description.trim()}
                className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold h-12 text-base shadow-lg shadow-amber-500/25 transition-all duration-200"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Carousel
              </Button>
            </Card>
          </motion.div>
        ) : null}

        {/* Loading / Progress Section */}
        {(step === 'planning' || step === 'generating') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {step === 'planning'
                      ? 'Generating Carousel Plan...'
                      : 'Creating Slide Images...'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {step === 'planning'
                      ? 'AI is analyzing your description and creating a BOFU carousel structure'
                      : `Generating image ${slides.filter(s => !s.isLoading).length + 1} of ${slides.length}`}
                  </p>
                </div>
              </div>
              <Progress value={progress} className="h-2 bg-white/10" />
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-slate-400">{progress}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelGeneration}
                  className="text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>

              {/* Show mini previews of slides being generated */}
              {slides.length > 0 && (
                <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
                  {slides.map((slide, index) => (
                    <div key={index} className="shrink-0">
                      {renderSlidePreview(slide, index, 'small')}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Complete Carousel Display */}
        {step === 'complete' && slides.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {carouselTitle}
              </h2>
              <div className="flex items-center justify-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {slides.length} Slides
                </Badge>
                <Badge className="bg-white/10 text-slate-300 border-white/20">
                  9:16 Vertical
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              {/* Slide Thumbnails (left side on desktop) */}
              <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[75vh] pb-2 lg:pb-0 lg:pr-2">
                {slides.map((slide, index) => {
                  const typeInfo = SLIDE_TYPE_LABELS[slide.slide_type] || {
                    label: slide.slide_type,
                    color: 'bg-slate-500',
                  };
                  const isActive = index === currentSlide;

                  return (
                    <div
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`shrink-0 cursor-pointer transition-all duration-200 ${
                        isActive
                          ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900'
                          : 'ring-1 ring-white/10 hover:ring-white/30'
                      }`}
                    >
                      <div className="relative">
                        {renderSlidePreview(slide, index, 'small')}
                        {/* Type badge */}
                        <div className="absolute bottom-1 left-1 right-1">
                          <span
                            className={`text-[8px] px-1 py-0.5 rounded text-white font-medium ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Main Slide Display */}
              <div className="flex flex-col items-center">
                <div className="relative w-full max-w-[400px]">
                  {/* Navigation arrows */}
                  <button
                    onClick={() =>
                      setCurrentSlide((prev) =>
                        prev > 0 ? prev - 1 : slides.length - 1
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentSlide((prev) =>
                        prev < slides.length - 1 ? prev + 1 : 0
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Current slide */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSlide}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
                    >
                      {slides[currentSlide]?.isLoading ? (
                        <div className="aspect-[9/16] bg-muted flex items-center justify-center">
                          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
                        </div>
                      ) : slides[currentSlide]?.error ? (
                        <div className="aspect-[9/16] bg-muted flex items-center justify-center p-6">
                          <div className="text-center">
                            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-2" />
                            <p className="text-sm text-destructive">
                              {slides[currentSlide].error}
                            </p>
                          </div>
                        </div>
                      ) : slides[currentSlide]?.imageData ? (
                        <div className="relative aspect-[9/16] cursor-pointer" onClick={() => setZoomedSlide(currentSlide)}>
                          <img
                            src={slides[currentSlide].imageData!}
                            alt={`Slide ${slides[currentSlide].slide_number}`}
                            className="w-full h-full object-cover"
                          />
                          {/* Text overlay */}
                          {renderTextOverlay(slides[currentSlide])}
                        </div>
                      ) : (
                        <div className="aspect-[9/16] bg-muted flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Slide info and controls */}
                <div className="mt-4 w-full max-w-[400px] space-y-3">
                  {/* Slide info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">
                        Slide {currentSlide + 1} / {slides.length}
                      </span>
                      {(() => {
                        const typeInfo = SLIDE_TYPE_LABELS[slides[currentSlide]?.slide_type] || {
                          label: slides[currentSlide]?.slide_type || '',
                          color: 'bg-slate-500',
                        };
                        return (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        );
                      })()}
                    </div>
                    {slides[currentSlide]?.imageData && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadSlide(currentSlide)}
                        className="text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                    )}
                  </div>

                  {/* Text info */}
                  {(slides[currentSlide]?.header_text || slides[currentSlide]?.body_text) && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      {slides[currentSlide]?.header_text && (
                        <p className="text-sm font-semibold text-white mb-1">
                          {slides[currentSlide].header_text}
                        </p>
                      )}
                      {slides[currentSlide]?.body_text && (
                        <p className="text-xs text-slate-400">
                          {slides[currentSlide].body_text}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Image prompt info */}
                  {slides[currentSlide]?.image_prompt && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                        Image Prompt
                      </p>
                      <p className="text-xs text-slate-400 line-clamp-3">
                        {slides[currentSlide].image_prompt}
                      </p>
                    </div>
                  )}

                  {/* Progress dots */}
                  <div className="flex justify-center gap-1.5 pt-2">
                    {slides.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          index === currentSlide
                            ? 'bg-amber-500 w-6'
                            : 'bg-white/20 hover:bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Zoom Dialog */}
        <Dialog
          open={zoomedSlide !== null}
          onOpenChange={(open) => !open && setZoomedSlide(null)}
        >
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-white/10 overflow-hidden">
            <DialogTitle className="sr-only">
              Slide {zoomedSlide !== null ? zoomedSlide + 1 : ''} Zoomed View
            </DialogTitle>
            {zoomedSlide !== null && slides[zoomedSlide]?.imageData && (
              <div className="relative aspect-[9/16] max-h-[85vh] mx-auto">
                <img
                  src={slides[zoomedSlide].imageData!}
                  alt={`Slide ${slides[zoomedSlide].slide_number}`}
                  className="w-full h-full object-contain"
                />
                {renderTextOverlay(slides[zoomedSlide])}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
