"use client";

import { educationInfo } from "@/data/portfolio";
import { FadeIn, SlideInUp } from "@/components/ui/animated";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ExternalLink,
  GraduationCap,
  Calendar,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { DEFAULT_BLUR_PLACEHOLDER } from "@/lib/utils/blur-placeholder";
import { useColorExtraction } from "@/lib/hooks/useColorExtraction";
import { HolographicCard } from "@/components/ui/holographic-card";
import { SkillCards, skillPresets } from "@/components/ui/skill-cards";
import { ProgressRing, educationProgress } from "@/components/ui/progress-ring";
import {
  InteractiveTimeline,
  TimelineNode,
} from "@/components/ui/interactive-timeline";
import { CertificationTimeline } from "@/components/ui/certification-timeline";
import { useState, useRef, useEffect } from "react";

interface EducationCardProps {
  school: (typeof educationInfo.schools)[0];
  index: number;
  shouldReduceAnimations: boolean;
}

function EducationCard({
  school,
  index,
  shouldReduceAnimations,
}: EducationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Use dynamic color extraction with fallback color
  const fallbackColor = "rgb(139, 92, 246)";
  const { color: extractedColor } = useColorExtraction(
    school.logo,
    fallbackColor,
  );

  // Determine education level for progress and skills
  const getEducationLevel = () => {
    if (school.subHeader.toLowerCase().includes("phd")) return "phd";
    if (
      school.subHeader.toLowerCase().includes("master") ||
      school.subHeader.toLowerCase().includes("msc")
    )
      return "master";
    return "bachelor";
  };

  const level = getEducationLevel();
  const progress = educationProgress[level];
  const skills = skillPresets[level];

  return (
    <motion.div
      ref={cardRef}
      className="relative h-full"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <HolographicCard
        glowColor={extractedColor.replace("rgb(", "").replace(")", "")}
        insideBackgroundColor={extractedColor
          .replace("rgb(", "")
          .replace(")", "")}
        className="h-full"
      >
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Header with logo and progress */}
          <div className="flex items-start gap-4 mb-6">
            {/* 3D Logo */}
            <div className="relative group">
              <div
                className="absolute -inset-1 rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity duration-500"
                style={{ backgroundColor: extractedColor }}
              />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-white dark:bg-white rounded-xl overflow-hidden transform transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl">
                <OptimizedImage
                  src={school.logo}
                  alt={`${school.schoolName} logo`}
                  fill
                  sizes="80px"
                  className="object-contain p-2"
                  crossOrigin="anonymous"
                  placeholder="blur"
                  blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
                  loading="lazy"
                />
              </div>
            </div>

            {/* Title and Progress */}
            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-bold mb-1 bg-gradient-to-r from-foreground to-foreground group-hover:from-primary group-hover:to-purple-600 bg-clip-text text-transparent transition-all duration-500">
                {school.subHeader}
              </h3>
              <Link
                href={school.schoolUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm sm:text-base text-primary hover:text-primary/80 transition-colors mb-2"
              >
                <GraduationCap className="w-4 h-4 flex-shrink-0" />
                {school.schoolName}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </Link>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                {school.duration}
              </div>
            </div>

            {/* Progress Ring */}
            <div className="hidden sm:block">
              <ProgressRing
                progress={progress.current}
                color={progress.color}
                size={80}
                strokeWidth={6}
                label={progress.label}
              />
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-4">
            {/* Thesis with expandable abstract */}
            <div className="relative">
              <div
                className="flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-all duration-300 hover:bg-muted/50"
                style={{
                  borderLeft: `3px solid ${extractedColor}`,
                  backgroundColor: `${extractedColor}05`,
                }}
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <Sparkles
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: extractedColor }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{school.desc}</p>
                  {school.research && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {school.research}
                    </p>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    isExpanded && "rotate-180",
                  )}
                />
              </div>

              {/* Expandable content */}
              {isExpanded && school.descBullets.length > 0 && (
                <div
                  className={cn(
                    "mt-3 pl-9 space-y-2 duration-300",
                    !shouldReduceAnimations && "animate-in slide-in-from-top-2",
                  )}
                >
                  {school.descBullets.map((bullet, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: extractedColor }}
                      />
                      <span className="text-muted-foreground">{bullet}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats (Mobile) */}
            <div className="sm:hidden flex items-center justify-center">
              <ProgressRing
                progress={progress.current}
                color={progress.color}
                size={70}
                strokeWidth={5}
                label={progress.label}
              />
            </div>
          </div>

          {/* Skill Cards */}
          <SkillCards
            skills={skills}
            color={extractedColor}
            delay={500 + index * 200}
            className="mt-6"
          />
        </div>
      </HolographicCard>
    </motion.div>
  );
}

export function Education() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [timelineNodes, setTimelineNodes] = useState<TimelineNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Calculate timeline node positions
  useEffect(() => {
    const updateNodes = () => {
      if (!sectionRef.current) return;

      const cards = sectionRef.current.querySelectorAll(
        "[data-education-card]",
      );
      const nodes: TimelineNode[] = Array.from(cards).map((card, index) => {
        const rect = card.getBoundingClientRect();
        const sectionRect = sectionRef.current!.getBoundingClientRect();

        const cardCenterY = rect.top - sectionRect.top + rect.height / 2;

        return {
          id: `node-${index}`,
          y: cardCenterY,
          color: "rgb(139, 92, 246)",
        };
      });

      setTimelineNodes(nodes);
    };

    updateNodes();
    window.addEventListener("resize", updateNodes);

    const timer = setTimeout(updateNodes, 1000);

    return () => {
      window.removeEventListener("resize", updateNodes);
      clearTimeout(timer);
    };
  }, []);

  // Scroll-based activation
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const cards = sectionRef.current.querySelectorAll(
        "[data-education-card]",
      );
      const windowCenter = window.innerHeight / 2;

      let closestIndex = -1;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenter - windowCenter);

        if (
          distance < closestDistance &&
          rect.top < windowCenter &&
          rect.bottom > windowCenter
        ) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveNodeId(closestIndex !== -1 ? `node-${closestIndex}` : null);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!educationInfo.display) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="absolute inset-0 bg-background -z-10" />
      <FadeIn className="text-center mb-12 sm:mb-16">
        <h2 className="section-title-gradient mb-4">{educationInfo.title}</h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto mb-6">
          <span className="text-primary font-semibold">
            {educationInfo.subtitle.highlightedText}
          </span>
          {""}
          {educationInfo.subtitle.normalText}
        </p>

        <div className="flex justify-center gap-6 sm:gap-8 mt-8">
          {/* ... stats ... */}
        </div>
      </FadeIn>

      <div ref={sectionRef} className="flex gap-4 sm:gap-8">
        {/* Neural Pathway Timeline */}
        <div className="relative h-auto">
          <InteractiveTimeline
            nodes={timelineNodes}
            activeNodeId={activeNodeId}
            onNodeHover={setActiveNodeId}
          />
        </div>

        {/* Education Cards */}
        <div className="flex-1 space-y-12 mr-8 sm:mr-16">
          {educationInfo.schools.map((school, index) => (
            <div
              key={index}
              data-education-card
              onMouseEnter={() => setActiveNodeId(`node-${index}`)}
              onMouseLeave={() => setActiveNodeId(null)}
            >
              <EducationCard
                school={school}
                index={index}
                shouldReduceAnimations={shouldReduceAnimations}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Professional Certifications & Training */}
      {educationInfo.certifications &&
        educationInfo.certifications.length > 0 && (
          <div className="mt-20">
            <SlideInUp delay={600} className="text-center mb-8">
              <h3 className="section-subtitle-gradient text-2xl md:text-3xl mb-2">
                {educationInfo.certificationSection.title}
              </h3>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                {educationInfo.certificationSection.subtitle}
              </p>
            </SlideInUp>
            <CertificationTimeline
              certifications={educationInfo.certifications}
              className="max-w-6xl mx-auto"
            />
          </div>
        )}
    </div>
  );
}
