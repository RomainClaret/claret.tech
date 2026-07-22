// Contact section data
export interface ContactInfo {
  title: string;
  subtitle: {
    highlightedText: string;
    normalText: string;
  };
  emailAddress: string;
  emailDesc: string;
}

export const contactInfo: ContactInfo = {
  title: "Contact",
  subtitle: {
    highlightedText: "Always collecting pieces of the puzzle",
    normalText:
      "Especially the ones that don't fit. Research collaborations, wild theories, or proof I'm wrong all welcome.",
  },
  emailAddress: "claret.tech.website.pessimist917@simplelogin.com",
  emailDesc: "Email me",
};
