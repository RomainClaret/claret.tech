"use client";

import { contactInfo, socialMediaLinks } from "@/data/portfolio";
import { FadeIn } from "@/components/ui/animated";
import { Mail, Twitter } from "lucide-react";
import { ProtectedLucideIcon } from "@/components/ui/protected-lucide-icon";
import Link from "next/link";
import Image from "next/image";
import { GitHubIcon, LinkedInIcon } from "@/components/icons";
import { EducationStyleCard } from "@/components/ui/education-style-card";
import { motion } from "framer-motion";

// Contact method colors
const CONTACT_COLORS = {
  email: "59, 130, 246", // Blue
  twitter: "56, 189, 248", // Sky Blue
  github: "139, 92, 246", // Purple
};

export function Contact() {
  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        <FadeIn className="text-center mb-12">
          <h2 className="section-title-gradient">{contactInfo.title}</h2>
          <p className="text-lg text-muted-foreground">
            <span className="text-primary font-semibold">
              {contactInfo.subtitle.highlightedText}
            </span>
            {""}
            {contactInfo.subtitle.normalText}
          </p>
        </FadeIn>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Contact Options */}
          <div className="space-y-8">
            {/* Email Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Link
                href={`mailto:${contactInfo.emailAddress}`}
                className="block"
              >
                <motion.div
                  className="relative"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {/* Neural glow effect */}
                  <motion.div
                    className="absolute -inset-1 rounded-2xl opacity-0 blur-xl"
                    style={{ backgroundColor: `rgb(${CONTACT_COLORS.email})` }}
                    initial={{ opacity: 0.2 }}
                    animate={{ opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <EducationStyleCard
                    glowColor={CONTACT_COLORS.email}
                    insideBackgroundColor={CONTACT_COLORS.email}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <motion.div
                            className="w-14 h-14 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: `rgba(${CONTACT_COLORS.email}, 0.1)`,
                            }}
                            whileHover={{ scale: 1.1 }}
                          >
                            <ProtectedLucideIcon
                              Icon={Mail}
                              className="w-7 h-7"
                              style={{ color: `rgb(${CONTACT_COLORS.email})` }}
                            />
                          </motion.div>
                          {/* Gentle breathing effect */}
                          <motion.div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                              backgroundColor: `rgb(${CONTACT_COLORS.email})`,
                              opacity: 0.1,
                            }}
                            animate={{
                              scale: [1, 1.15, 1],
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1 bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                            {contactInfo.emailDesc}
                          </h3>
                          <p className="text-muted-foreground break-all">
                            {contactInfo.emailAddress}
                          </p>
                        </div>
                      </div>
                    </div>
                  </EducationStyleCard>
                </motion.div>
              </Link>
            </motion.div>

            {/* Twitter Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Link
                href={contactInfo.twitterUrl}
                target={contactInfo.newTab ? "_blank" : undefined}
                rel={contactInfo.newTab ? "noopener noreferrer" : undefined}
                className="block"
              >
                <motion.div
                  className="relative"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {/* Neural glow effect */}
                  <motion.div
                    className="absolute -inset-1 rounded-2xl opacity-0 blur-xl"
                    style={{
                      backgroundColor: `rgb(${CONTACT_COLORS.twitter})`,
                    }}
                    initial={{ opacity: 0.2 }}
                    animate={{ opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <EducationStyleCard
                    glowColor={CONTACT_COLORS.twitter}
                    insideBackgroundColor={CONTACT_COLORS.twitter}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <motion.div
                            className="w-14 h-14 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: `rgba(${CONTACT_COLORS.twitter}, 0.1)`,
                            }}
                            whileHover={{ scale: 1.1 }}
                          >
                            <ProtectedLucideIcon
                              Icon={Twitter}
                              className="w-7 h-7"
                              style={{
                                color: `rgb(${CONTACT_COLORS.twitter})`,
                              }}
                            />
                          </motion.div>
                          {/* Gentle breathing effect */}
                          <motion.div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                              backgroundColor: `rgb(${CONTACT_COLORS.twitter})`,
                              opacity: 0.1,
                            }}
                            animate={{
                              scale: [1, 1.15, 1],
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1 bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                            {contactInfo.twitterDesc}
                          </h3>
                          <p className="text-muted-foreground">
                            @{contactInfo.twitterUrl.split("/").pop()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </EducationStyleCard>
                </motion.div>
              </Link>
            </motion.div>

            {/* LinkedIn Card */}
            <motion.div
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
                <motion.div
                  className="relative"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {/* Neural glow effect */}
                  <motion.div
                    className="absolute -inset-1 rounded-2xl opacity-0 blur-xl"
                    style={{
                      backgroundColor: `rgb(10, 102, 194)`,
                    }}
                    initial={{ opacity: 0.2 }}
                    animate={{ opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <EducationStyleCard
                    glowColor="10, 102, 194"
                    insideBackgroundColor="10, 102, 194"
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <motion.div
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
                          </motion.div>
                          {/* Gentle breathing effect */}
                          <motion.div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                              backgroundColor: `rgb(10, 102, 194)`,
                              opacity: 0.1,
                            }}
                            animate={{
                              scale: [1, 1.15, 1],
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1 bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                            Connect on LinkedIn
                          </h3>
                          <p className="text-muted-foreground">@RomainClaret</p>
                        </div>
                      </div>
                    </div>
                  </EducationStyleCard>
                </motion.div>
              </Link>
            </motion.div>
          </div>

          {/* Right Column - GitHub Avatar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex justify-center"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative"
            >
              {/* Neural glow effect */}
              <motion.div
                className="absolute -inset-1 rounded-full opacity-0 blur-xl"
                style={{
                  backgroundColor: `rgb(${CONTACT_COLORS.github})`,
                }}
                initial={{ opacity: 0.2 }}
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <EducationStyleCard
                glowColor={CONTACT_COLORS.github}
                insideBackgroundColor={CONTACT_COLORS.github}
                className="rounded-full"
              >
                <div className="p-1 rounded-full">
                  <div className="relative overflow-hidden rounded-full">
                    <Image
                      src={`https://github.com/${process.env.NEXT_PUBLIC_GH_USERNAME || "RomainClaret"}.png`}
                      alt="GitHub Profile"
                      width={300}
                      height={300}
                      className="rounded-full"
                      priority
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAoDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFB//EACYQAAIBAwMEAQUAAAAAAAAAAAECAwAEEQUSITFBUWEGExQiMoH/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABcRAQEBAQAAAAAAAAAAAAAAAAECEQD/2gAMAwEAAhEDEQA/ANLviNwkhABCkgHxU2N2VgysVI6EGrN2zSXEkhGCx61EuI8EkAYNZsYV//Z"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
              </EducationStyleCard>

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
                <motion.div
                  className="rounded-full p-3 shadow-xl cursor-pointer"
                  style={{ backgroundColor: `rgb(${CONTACT_COLORS.github})` }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <GitHubIcon size={28} className="text-white" />
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
