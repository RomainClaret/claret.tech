"use client";

import { socialMediaLinks } from "@/data/portfolio";
import { FadeIn } from "@/components/ui/animated";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import {
  GitHubIcon,
  LinkedInIcon,
  GitLabIcon,
  MediumIcon,
  TwitterIcon,
  StackOverflowIcon,
  InstagramIcon,
  OrcidIcon,
  RedditIcon,
} from "@/components/icons";

const iconMap = {
  github: { Icon: GitHubIcon, color: "#333" },
  linkedin: { Icon: LinkedInIcon, color: "#0077B5" },
  gitlab: { Icon: GitLabIcon, color: "#FC6D26" },
  medium: { Icon: MediumIcon, color: "#00AB6C" },
  twitter: { Icon: TwitterIcon, color: "#1DA1F2" },
  stackoverflow: { Icon: StackOverflowIcon, color: "#F48024" },
  instagram: { Icon: InstagramIcon, color: "#E4405F" },
  orcid: { Icon: OrcidIcon, color: "#A6CE39" },
  reddit: { Icon: RedditIcon, color: "#FF4500" },
};

export function SocialLinks() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  if (!socialMediaLinks.display) return null;

  const links = Object.entries(socialMediaLinks)
    .filter(([key, value]) => key !== "display" && value)
    .map(([key, url]) => {
      const iconData = iconMap[key as keyof typeof iconMap];
      return {
        name: key,
        url: url as string,
        Icon: iconData.Icon,
        color: iconData.color,
      };
    });

  return (
    <FadeIn className="flex flex-wrap gap-4 justify-center">
      {links.map(({ name, url, Icon, color }, index) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "group relative transform transition-all duration-300 hover:scale-110 active:scale-95",
            !shouldReduceAnimations && "animate-fade-in",
          )}
          style={
            !shouldReduceAnimations
              ? { animationDelay: `${index * 100}ms` }
              : {}
          }
          aria-label={`Visit my ${name} profile`}
          onMouseEnter={(e) => {
            const svg = e.currentTarget.querySelector("svg");
            if (svg) svg.style.color = color;
          }}
          onMouseLeave={(e) => {
            const svg = e.currentTarget.querySelector("svg");
            if (svg) svg.style.color = "";
          }}
        >
          <div className="relative">
            <Icon
              size={32}
              className="text-foreground/70 transition-all duration-300 group-hover:rotate-12"
            />
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ backgroundColor: `${color}30` }}
            />
          </div>
        </a>
      ))}
    </FadeIn>
  );
}
