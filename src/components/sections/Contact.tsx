"use client";

import { contactInfo, socialMediaLinks } from "@/data/portfolio";
import { Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { GitHubIcon, LinkedInIcon } from "@/components/icons";
import { EducationStyleCard } from "@/components/ui/education-style-card";
import { m } from "framer-motion";
import { useAnimationGate } from "@/lib/hooks/useMotionGate";

// Contact method colors
const CONTACT_COLORS = {
  email: "59, 130, 246", // Blue
  github: "139, 92, 246", // Purple
};

// The glows breathe only while the section is on screen; otherwise they hold
// their resting opacity, which is also where the loop starts.
const GLOW_LOOP = { opacity: [0.2, 0.4, 0.2] };
const GLOW_REST = { opacity: 0.2 };
const GLOW_LOOP_TRANSITION = { duration: 3, repeat: Infinity };
const GLOW_REST_TRANSITION = { duration: 0 };

export function Contact() {
  // Not tied to the site's animation switch: these loops never were, and
  // Safari, where the switch starts off, would otherwise lose them.
  const { ref: motionRef, active: motionActive } = useAnimationGate({
    respectPlaying: false,
  });
  const glowAnimate = motionActive ? GLOW_LOOP : GLOW_REST;
  const glowTransition = motionActive
    ? GLOW_LOOP_TRANSITION
    : GLOW_REST_TRANSITION;

  return (
    // overflow-x-clip: on a phone the avatar column is as wide as the screen
    // inside the padding, and its entrance starts it 20 px to the right. The
    // server's HTML paints it there until the bundle runs, and the page
    // panned sideways by 4 px. Clipped, not hidden: no scroll container.
    <div
      ref={motionRef}
      data-anim={motionActive ? "on" : "off"}
      className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative overflow-x-clip"
    >
      <div className="lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-title-gradient">{contactInfo.title}</h2>
          <p className="text-lg text-muted-foreground">
            <span className="text-primary font-semibold">
              {contactInfo.subtitle.highlightedText}
            </span>
            {" • "}
            {contactInfo.subtitle.normalText}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Contact Options */}
          <div className="space-y-8">
            {/* Email Card */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Link
                href={`mailto:${contactInfo.emailAddress}`}
                className="block"
              >
                <m.div
                  className="relative"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {/* Neural glow effect */}
                  <m.div
                    className="absolute -inset-1 rounded-2xl opacity-0 blur-xl"
                    style={{ backgroundColor: `rgb(${CONTACT_COLORS.email})` }}
                    initial={{ opacity: 0.2 }}
                    animate={glowAnimate}
                    transition={glowTransition}
                  />
                  <EducationStyleCard
                    glowColor={CONTACT_COLORS.email}
                    insideBackgroundColor={CONTACT_COLORS.email}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <m.div
                            className="w-14 h-14 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: `rgba(${CONTACT_COLORS.email}, 0.1)`,
                            }}
                            whileHover={{ scale: 1.1 }}
                          >
                            <Mail
                              className="w-7 h-7"
                              style={{ color: `rgb(${CONTACT_COLORS.email})` }}
                            />
                          </m.div>
                          {/* Gentle breathing effect: a CSS loop
                              (motion.css) */}
                          <div
                            className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-115"
                            style={{
                              backgroundColor: `rgb(${CONTACT_COLORS.email})`,
                              opacity: 0.1,
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1 bg-linear-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                            {contactInfo.emailDesc}
                          </h3>
                          <p className="text-muted-foreground break-all">
                            {contactInfo.emailAddress}
                          </p>
                        </div>
                      </div>
                    </div>
                  </EducationStyleCard>
                </m.div>
              </Link>
            </m.div>

            {/* LinkedIn Card */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <Link
                href={socialMediaLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <m.div
                  className="relative"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {/* Neural glow effect */}
                  <m.div
                    className="absolute -inset-1 rounded-2xl opacity-0 blur-xl"
                    style={{
                      backgroundColor: `rgb(10, 102, 194)`,
                    }}
                    initial={{ opacity: 0.2 }}
                    animate={glowAnimate}
                    transition={glowTransition}
                  />
                  <EducationStyleCard
                    glowColor="10, 102, 194"
                    insideBackgroundColor="10, 102, 194"
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <m.div
                            className="w-14 h-14 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: `rgba(10, 102, 194, 0.1)`,
                            }}
                            whileHover={{ scale: 1.1 }}
                          >
                            <LinkedInIcon
                              className="w-7 h-7"
                              style={{
                                color: `rgb(10, 102, 194)`,
                              }}
                            />
                          </m.div>
                          {/* Gentle breathing effect: a CSS loop
                              (motion.css) */}
                          <div
                            className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-115"
                            style={{
                              backgroundColor: `rgb(10, 102, 194)`,
                              opacity: 0.1,
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1 bg-linear-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                            Connect on LinkedIn
                          </h3>
                          <p className="text-muted-foreground">@RomainClaret</p>
                        </div>
                      </div>
                    </div>
                  </EducationStyleCard>
                </m.div>
              </Link>
            </m.div>
          </div>

          {/* Right Column - GitHub Avatar */}
          <m.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex justify-center"
          >
            <m.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative"
            >
              {/* Neural glow effect */}
              <m.div
                className="absolute -inset-1 rounded-full opacity-0 blur-xl"
                style={{
                  backgroundColor: `rgb(${CONTACT_COLORS.github})`,
                }}
                initial={{ opacity: 0.2 }}
                animate={glowAnimate}
                transition={glowTransition}
              />
              <Link
                href={
                  socialMediaLinks.github || "https://github.com/RomainClaret"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <EducationStyleCard
                  glowColor={CONTACT_COLORS.github}
                  insideBackgroundColor={CONTACT_COLORS.github}
                  className="rounded-full"
                >
                  <div className="p-1 rounded-full">
                    <div className="relative overflow-hidden rounded-full">
                      <Image
                        // The GitHub avatar, as a local file: the optimizer
                        // takes no remote image (next.config.mjs). A new
                        // avatar gets a new file name, as /images is cached
                        // for a year.
                        src="/images/github-avatar-2026-10.jpg"
                        alt="GitHub Profile"
                        width={300}
                        height={300}
                        className="rounded-full"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAoDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFB//EACYQAAIBAwMEAQUAAAAAAAAAAAECAwAEEQUSITFBUWEGExQiMoH/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABcRAQEBAQAAAAAAAAAAAAAAAAECEQD/2gAMAwEAAhEDEQA/ANLviNwkhABCkgHxU2N2VgysVI6EGrN2zSXEkhGCx61EuI8EkAYNZsYV//Z"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-primary/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </div>
                </EducationStyleCard>
              </Link>

              {/* Floating GitHub icon - clickable */}
              <Link
                href={
                  socialMediaLinks.github || "https://github.com/RomainClaret"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="absolute -bottom-2 -right-2 block"
                aria-label="GitHub Profile"
              >
                <m.div
                  className="rounded-full p-3 shadow-xl cursor-pointer"
                  style={{ backgroundColor: `rgb(${CONTACT_COLORS.github})` }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <GitHubIcon size={28} className="text-white" />
                </m.div>
              </Link>
            </m.div>
          </m.div>
        </div>
      </div>
    </div>
  );
}
