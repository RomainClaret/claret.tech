import { workExperiences, papersSection } from "@/data/portfolio";

export function generateStructuredData() {
  const baseUrl = "https://claret.tech";

  // Person Schema (Primary)
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${baseUrl}/#person`,
    name: "Romain Claret",
    alternateName: "RomainClaret",
    url: baseUrl,
    image: "https://github.com/RomainClaret.png",
    sameAs: [
      "https://github.com/RomainClaret",
      "https://www.linkedin.com/in/RomainClaret",
      "https://medium.com/@romainclaret",
      "https://twitter.com/romainclaret",
      "https://orcid.org/0000-0002-6872-7815",
      "https://stackoverflow.com/users/4023950/romain-claret",
      "https://gitlab.com/romainclaret",
    ],
    jobTitle: "AI Software Engineer & PhD Researcher",
    worksFor: {
      "@type": "Organization",
      name: "University of Neuchâtel",
      url: "https://www.unine.ch",
    },
    alumniOf: [
      {
        "@type": "EducationOrganization",
        name: "University of Neuchâtel",
        url: "https://www.unine.ch",
      },
      {
        "@type": "EducationOrganization",
        name: "HES-SO University of Applied Sciences",
        url: "https://www.hes-so.ch",
      },
    ],
    knowsAbout: [
      "Artificial Intelligence",
      "Machine Learning",
      "Neuroevolution",
      "Software Engineering",
      "Distributed Systems",
      "Python",
      "JAX",
      "TypeScript",
      "React",
      "Next.js",
    ],
    description:
      "PhD Researcher focusing on neuroevolution and compositional AI. Creator of GEENNS (Grid-based Emergent Evolution of Neocortical Network Substrates).",
  };

  // WebSite Schema with SearchAction
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    url: baseUrl,
    name: "Romain Claret - Evolving Artificial Intelligence",
    description:
      "Researcher breeding compositional AI through evolution. Making intelligence emerge, not engineering it.",
    publisher: {
      "@id": `${baseUrl}/#person`,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  // BreadcrumbList Schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${baseUrl}/#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Skills",
        item: `${baseUrl}#skills`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Experience",
        item: `${baseUrl}#experience`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Projects",
        item: `${baseUrl}#projects`,
      },
      {
        "@type": "ListItem",
        position: 5,
        name: "Research",
        item: `${baseUrl}#research`,
      },
      {
        "@type": "ListItem",
        position: 6,
        name: "Papers",
        item: `${baseUrl}#papers`,
      },
    ],
  };

  // WorkHistory Schema
  const workHistorySchema = workExperiences.display
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": `${baseUrl}/#work-history`,
        name: "Romain Claret",
        hasOccupation: workExperiences.experience.map((exp) => ({
          "@type": "Occupation",
          name: exp.role,
          educationRequirements: exp.desc || undefined,
          responsibilities:
            exp.descBullets.length > 0 ? exp.descBullets.join(". ") : undefined,
          occupationLocation: {
            "@type": "Organization",
            name: exp.company,
            url: exp.companyUrl,
            logo: `${baseUrl}${exp.companyLogo}`,
            description: exp.companyDesc,
          },
          startDate: exp.date.split(" - ")[0],
          endDate: exp.date.includes("Present")
            ? undefined
            : exp.date.split(" - ")[1],
        })),
      }
    : null;

  // ScholarlyArticle Schema for Papers
  const articlesSchema =
    papersSection.display && papersSection.papersCards
      ? papersSection.papersCards.map((paper, index) => ({
          "@context": "https://schema.org",
          "@type": "ScholarlyArticle",
          "@id": `${baseUrl}/#paper-${index}`,
          headline: paper.title,
          name: paper.title,
          description: paper.subtitle,
          author: [{ "@type": "Person", name: "Romain Claret" }],
          datePublished: paper.date,
          url: paper.footerLink?.[0]?.url || undefined,
          image: paper.image ? `${baseUrl}${paper.image}` : undefined,
        }))
      : [];

  // Note: Projects are fetched dynamically from GitHub API at runtime
  // They cannot be included in static structured data
  const projectsSchema: object[] = [];

  // Combine all schemas using @graph
  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [
      personSchema,
      websiteSchema,
      breadcrumbSchema,
      ...(workHistorySchema ? [workHistorySchema] : []),
      ...articlesSchema,
      ...projectsSchema,
    ].filter(Boolean),
  };

  return combinedSchema;
}
