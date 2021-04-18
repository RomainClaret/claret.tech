/* Change this file to get your personal Portfolio */

// Summary And Greeting Section

import emoji from "react-easy-emoji";

const illustration = {
  animated: false // set to false to use static SVG
};

const greeting = {
  displayGreeting: true, // Set false to hide this section, defaults to true
  username: "Claret.Tech",
  title_greeting: "Greetings!",
  title_greeting_newline: "I am Romain, ",
  title_greeting_title_list: [
    "a Software Enginneer.",1000,
    "a PhD Student.",1000,
    "a Lecturer.",1000,
    "a Teaching Assistant.",1000,
    "a Roleplayer.",1000,
    "a Data Scientist.",1000,
    "an AI Addict.",1000,
    "a Technology Hacker.",1000,
    "a Penguin Worshiper.",1000,
    "an Open-source Contributor.",1000,
    "a Sci-fi writer.",1000,
    "an UNIX evangelist.",1000,
  ],
  subTitle: emoji(
    "Currently focusing my Ph.D. research on Artificial General Intelligence. Self-diagnosed with an addiction to Autonomous Artificial Entities, passionated by any AI-driven technologies, and naively believing in decentralized consensuses."
  ),
  resumeLink: "https://docs.google.com/gview?url=https://claret.tech/pdfs/RomainClaret_CV.pdf"
};

// Social Media Links

const socialMediaLinks = {
  display: true, // Set true to display this section, defaults to false
  orcid: "https://orcid.org/0000-0002-5612-8471",
  github: "https://github.com/RomainClaret",
  linkedin: "https://www.linkedin.com/in/romainclaret/",
  //gmail: "saadpasta70@gmail.com",
  gitlab: "https://gitlab.com/RomainClaret",
  //facebook: "https://www.facebook.com/saad.pasta7",
  medium: "https://medium.com/@RomainClaret",
  twitter: "https://twitter.com/RomainClaret",
  stackoverflow: "https://stackoverflow.com/users/9648764/romain-claret",
  instagram: "https://www.instagram.com/weak_intelligence/",
};

// Skills Section

const skillsSection = {
  display: true, // Set false to hide this section, defaults to true
  title: "What I do",
  subTitle: "PRETTY MUCH ANYTHING RELATED TO SOFTWARE ENGINEERING AND ARTIFICIAL INTELLIGENCE",
  skills: [
    emoji(
      "⚡ Hack around anything that touches autonomous artificial entities and contributes to open-source projects."
    ),
    emoji(
      "🔗 Have a background in distributed-data and blockchain protocols."
    ),

  ],

  /* Make Sure to include correct Font Awesome Classname to view your icon
https://fontawesome.com/icons?d=gallery */

  softwareSkills: [
    {
      skillName: "Python",
      fontAwesomeClassname: "fab fa-python"
    },
    {
      skillName: "Machine Learning",
      fontAwesomeClassname: "fas fa-brain"
    },
    {
      skillName: "Algorithms",
      fontAwesomeClassname: "fas fa-calculator"
    },
    {
      skillName: "Research",
      fontAwesomeClassname: "fas fa-flask"
    },
    {
      skillName: "Teaching",
      fontAwesomeClassname: "fas fa-graduation-cap"
    },
    {
      skillName: "Blockchain",
      fontAwesomeClassname: "fas fa-link"
    },
    {
      skillName: "Consulting",
      fontAwesomeClassname: "fas fa-puzzle-piece"
    },
    {
      skillName: "Open-source",
      fontAwesomeClassname: "fab fa-github"
    },
    {
      skillName: "Nonprofit",
      fontAwesomeClassname: "fas fa-users"
    },
    
    /*
    {
      skillName: "Docker",
      fontAwesomeClassname: "fab fa-docker"
    },
    {
      skillName: "Roleplay",
      fontAwesomeClassname: "fas fa-dice-d20"
    }
    */
  ]
};

// Education Section

const educationInfo = {
  display: true, // Set false to hide this section, defaults to true
  schools: [
    {
      schoolName: "University of Neuchâtel, Switzerland",
      school_url: "https://www.unine.ch",
      logo: require("./assets/images/unine_logo.jpg"),
      subHeader: "PhD in Computer Science",
      duration: "November 2020 - Present",
      desc: "Thesis: [defining the subject]",
      research: "",
      descBullets: [
        "Research: Meta-Learning, Machine Reasoning, Graphs, Grounded Symbolics, Natural Language Processing, and Knowledge Representation.",
        "Teaching Assistant (Bachelor in Economics): Analysis, Linear Algebra, and Databases",
        "Lecturer (Bachelor in Healthcare): 'Demystifying Artificial Intelligence for Health Professionals'"
      ]
    },
    {
      schoolName: "HES-SO University of Applied Sciences and Arts Western Switzerland, Lausanne, Switzerland",
      school_url: "https://master.hes-so.ch/master",
      logo: require("./assets/images/hes_so_logo_master.png"),
      subHeader: "Master of Science in Engineering in Software Engineering",
      duration: "September 2017 - April 2019",
      desc: "Thesis: GraphQA - a Multi-hop Conversational Question-Answering Chatbot using Sub-Knowledge Graphs",
      descBullets: ["Specialized in Machine Learning"]
    },
    {
      schoolName: "HES-SO University of Applied Sciences and Arts Western Switzerland, Neuchâtel, Switzerland",
      school_url: "https://www.he-arc.ch/",
      logo: require("./assets/images/he_arc_logo.png"),
      subHeader: "Bachelor of Science in Computer Science",
      duration: "September 2013 - August 2016",
      desc:
        "Thesis: Overclouds - an Anonymous and Decentralized Browser-based Data-sharing Service",
      descBullets: [
        "REH-SO: Head of Communication at the umbrella organization for HES-SO Students",
        "My Arc: Founder of a social media and shortcut platform for HE-ARC Students"
    ]
    }
  ]
};

// Your top 3 proficient stacks/tech experience

const techStack = {
  viewSkillBars: false, //Set it to true to show Proficiency Section
  experience: [
    {
      Stack: "Frontend/Design", //Insert stack or technology you have experience in
      progressPercentage: "90%" //Insert relative proficiency in percentage
    },
    {
      Stack: "Backend",
      progressPercentage: "70%"
    },
    {
      Stack: "Programming",
      progressPercentage: "60%"
    }
  ],
  displayCodersrank: false // Set true to display codersrank badges section need to changes your username in src/containers/skillProgress/skillProgress.js:17:62, defaults to false
};

// Work experience section

const workExperiences = {
  display: true, //Set it to true to show workExperiences Section
  experience: [
    {
      role: "Founder",
      company: "Artificialkind",
      company_url: "https://artificialkind.com/",
      companylogo: require("./assets/images/artificialkind_logo.png"),
      company_desc: "Supercharging the Humankind with Artificial Entities",
      date: "Present – Jan. 2018",
      desc: "We build autonomous artificial entities and a hybrid ecosystem for you and them. Reshaping standards and establishing new meaningful foundations for the humanity by closely working with our community. Not only providing cutting-edge technologies, products, and services, we are also training you to use them.",
      descBullets: [
        "Neuchâtel, Switzerland",
        "#AGI #AutonomousAI #MachineLearning #Nonprofit #R&D #HighTechDriven",
      ]
    },
    {
      role: "IT Independent",
      company: "Claret.Tech",
      company_url: "https://claret.tech/",
      companylogo: require("./assets/images/clarettech_logo.jpg"),
      company_desc: "Providing consulting for Blockchain, Smart-Contracts and AI",
      date: "Sep. 2018 – July 2017",
      desc: "The tasks were to advise and suggest technologies, define project scopes, document, prototype, and prepare workshops. Active in the domains of Automation, Finance, Art, Video Games, and Non-Profit Organisation.",
      descBullets: [
        "Geneva area, Lausanne area, and Solothurn, Switzerland",
        "#Blockchain #SmartContracts #Python #MachineLearning #Tensorflow #NodeJS #IoT #HelpingStartups #ICO",
      ]
    },
    {
      role: "Co-Founder",
      company: "Versicherix",
      company_url: "https://versicherix.com/",
      companylogo: require("./assets/images/versicherix_logo.png"),
      company_desc: "InsurTech Startup providing blockchain-based services",
      date: "June 2017 - Nov. 2016",
      desc: "In charge of Blockchain & Innovation, the tasks were to make software architectures, do high-level schematics for company products, project management, conduct workshops, prototype & implement software, and write documentation. Also participating in Startup tasks such as administration, fundraising, exhibitions, partnerships, and market studies.",
      descBullets: [
        "Solothurn, Switzerland",
        "#Ethereum #SmartContracts #ERC20 #TOGAF #NodeJS #CI/CD #Azure #Python #MicroServices #Agile #PHP"
      ]
    },
    {
      role: "Founder",
      company: "Overclouds",
      company_url: "https://github.com/RomainClaret/OverClouds",
      companylogo: require("./assets/images/overclouds_logo.png"),
      company_desc: "Open-Source consensus-based distributed file-hosting service",
      date: "Oct. 2016 - Dec, 2015",
      desc: "Lead developer on an Open-Source project. The tasks were to make software architectures, prototype & implement software, write documentation, and do research.",
      descBullets: [
        "Neuchâtel, Switzerland",
        "#WebRTC #P2P #WebTorrents #NodeJS #Serverless #Distributed #Privacy #DistributedConsensus #Blockchain",
      ]
    },
    {
      role: "Founder",
      company: "Libacy",
      companylogo: require("./assets/images/libacy_logo.png"),
      company_desc: "Streaming-based service for a multimedia library Startup",
      date: "Oct. 2015 - Oct. 2010",
      desc: "Lead developer and executive at a media-services provider Startup. The tasks were to do prototypes & implement software, make digital rights management & software architectures, write documentation, build the business model, do market studies, do fundraising, create partnerships with Film Studios, and comply with copyright laws.",
      descBullets: [
        "Project name: MovieCircle",
        "Neuchâtel, Switzerland",
        "#NodeJS #PHP #Python #Cryptography #MachineVision #FilmAuthentication #FamilySharing #WebRTC #AWS",
      ]
    },
    {
      role: "Internship",
      company: "Jenks Vestibular Lab",
      company_url: "https://www.masseyeandear.org/research/otolaryngology/vestibular",
      companylogo: require("./assets/images/jvpl_logo.png"),
      company_desc: "Development of balance aids for patients suffering imbalance, as well as vestibular implants for patients who have lost inner ear function.",
      date: "Aug. 2010 - May 2010",
      desc: "Design an experiment to identify a link between vision and the vestibular system. The tasks were to build in 3D the setup, construct the setup by adapting a hydraulic flight simulator, run Matlab simulations, experiment on human subjects, and interpret the results.",
      descBullets: [
        "See poster 11/2010",
        "Massachusetts Eye & Ear Infirmary, Harvard Medical School, Boston, United States of America",
      ]
    },
    {
      role: "Internships",
      company: "Manufacture Claret",
      company_url: "https://www.christopheclaret.com/",
      companylogo: require("./assets/images/manufactureclaret_logo.jpg"),
      company_desc: "Respect for watchmaking traditions and time-honoured savoir faire go hand in hand with a quest for innovation and excellence",
      date: "Summers in 2012, 2006, 2005, 2004",
      //desc: "Internships in watchmaking industry.",
      descBullets: [
        "Watchmaking research and development using 3D computer-aided design (CAD).",
        "Manufacturing, chamfering, and technical control.",
        "Disassembly, reassembly and customization of a mechanical pocket watch.",
        "3D CAD construction and technical drawing of watch movements.",
        "Le Locle, Switzerland",
      ]
    },
  ]
};

/* Your Open Source Section to View Your Github Pinned Projects
To know how to get github key look at readme.md */

const openSource = {
  display: true, // Set false to hide this section, defaults to true
  showGithubProfile: 'false' // Set true or false to show Contact profile using Github, defaults to true
};

// Some big projects you have worked on

const bigProjects = {
  display: false, // Set false to hide this section, defaults to true
  title: "Big Projects",
  subtitle: "SOME STARTUPS AND COMPANIES THAT I HELPED TO CREATE THEIR TECH",
  projects: [
    {
      image: require("./assets/images/saayaHealthLogo.webp"),
      projectName: "Saayahealth",
      projectDesc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
      footerLink: [
        {
          name: "Visit Website",
          url: "http://saayahealth.com/"
        }
        //  you can add extra buttons here.
      ]
    },
    {
      image: require("./assets/images/nextuLogo.webp"),
      projectName: "Nextu",
      projectDesc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
      footerLink: [
        {
          name: "Visit Website",
          url: "http://nextu.se/"
        }
      ]
    }
  ]
};

// Achievement Section
// Include certificates, talks etc

const achievementSection = {
  display: false, // Set false to hide this section, defaults to true
  title: emoji("Achievements And Certifications 🏆"),
  subtitle:
    "Achievements, Certifications, Award Letters and Some Cool Stuff that I have done !",

  achievementsCards: [
    {
      title: "asdasd",
      subtitle:
        "sad",
      image: require("./assets/images/codeInLogo.webp"),
      footerLink: []
    },
    {
      title: "asdsad",
      subtitle:
        "asd",
      image: require("./assets/images/googleAssistantLogo.webp"),
      footerLink: []
    }
  ]
};

// Papers Section

const papersSection = {
  display: true, // Set false to hide this section, defaults to true
  title: emoji("Papers, Posters, and Theses"),
  subtitle: "Stuff that I wrote or contibuted to",

  papersCards: [
    {
      title: "Master's Thesis",
      date: "03.2020",
      subtitle: "We propose an innovative approach for question-answering chatbots to handle conversational contexts and generate natural language sentences as answers. In addition to the ability to answer open-domain questions, our zero-shot learning approach, which uses a pure algorithmic orchestration in a grounded learning manner, provides a modular architecture to swap statically or dynamically task-oriented models while preserving its independence to training.",
      image: require("./assets/images/paper_graphqa_2020.png"),
      footerLink: [
        {
          name: "Read Thesis",
          url: "https://docs.google.com/gview?url=https://claret.tech/pdfs/RomainClaret_Msc_Thesis.pdf"
        },
        {
          name: "Read Poster",
          url: "https://docs.google.com/gview?url=https://claret.tech/pdfs/RomainClaret_Msc_Thesis_Poster.pdf"
        },
        {
          name: "Code",
          url: "https://github.com/RomainClaret/mse.thesis.code"
        }
      ]
    },
    {
      title: "Blockchain, a techie overview",
      date: "09.2016",
      subtitle: "As of 2016, Blockchain is a buzzword associated with shady cryptocurrencies and not a distributed ledger framework. This technology is widely misunderstood, and false visions are propagated. As a result, Blockchain is categorized as some mystical technology that nobody understands. In this paper, we try to overview what Blockchain is and help the reader make an opinion about it from a technical perspective.",
      image: require("./assets/images/paper_blockchain_2016.png"),
      footerLink: [
        {
          name: "Read Paper",
          url: "https://docs.google.com/gview?url=https://claret.tech/pdfs/paper_blockchain_small_techie_overview_2016.pdf"
        }
      ]
    },
    {
      title: "Bachelor Thesis",
      date: "07.2016",
      subtitle: "The initiative behind this project is to create a new generation of decentralized services to offer data sharing with a digital democracy over Internet. The services also want to be adapted to today’s paranoia about Internet privacy as well as the preservation of knowledge for the next human generations. The idea is to give the ability to the user to not rely on corporate servers, or farms of servers (cloud) anymore.",
      image: require("./assets/images/overclouds_logo.png"),
      footerLink: [
        {
          name: "Read Thesis",
          url: "https://docs.google.com/gview?url=https://claret.tech/pdfs/RomainClaret_Bsc_Thesis.pdf"
        },
        {
          name: "Read Poster",
          url: "https://docs.google.com/gview?url=https://claret.tech/pdfs/RomainClaret_Bsc_Thesis_Poster.pdf"
        },
        {
          name: "Code",
          url: "https://github.com/RomainClaret/OverClouds"
        }
      ]
    },
    {
      title: "Poster",
      date: "11.2010",
      subtitle: "Prior studies show that visual motion perception is more precise than vestibular motion perception, but it is unclear whether this is universal or the result of specific experimental conditions. We compared visual and vestibular motion precision over a broad range of temporal frequencies by measuring thresholds for vestibular (subject motion in the dark), visual (visual scene motion) or visual-vestibular (subject motion in the light) stimuli.",
      image: require("./assets/images/paper_visual_vestibular_2013.png"),
      footerLink: [
        {
          name: "Read Poster", 
          url: "https://docs.google.com/gview?url=https://claret.tech/pdfs/poster_visual_vestibular_integration_in_sensory_recognition_thresholds_2010.pdf"
        },
        {
          name: "Read related Paper", 
          url: "https://docs.google.com/gview?url=https://claret.tech/pdfs/paper_doi_10.1152_jn_00332_2013_2013.pdf"
        }
      ]
    }
  ]
};

// Blogs Section

const blogSection = {
  display: false, // Set false to hide this section, defaults to true
  title: "Blogs",
  subtitle:
    "With Love for Developing cool stuff, I love to write and teach others what I have learnt.",

  blogs: [
    {
      url:
        "https://blog.usejournal.com/create-a-google-assistant-action-and-win-a-google-t-shirt-and-cloud-credits-4a8d86d76eae",
      title: "Win a Google Assistant Tshirt and $200 in Google Cloud Credits",
      description:
        "Do you want to win $200 and Google Assistant Tshirt by creating a Google Assistant Action in less then 30 min?"
    },
    {
      url: "https://medium.com/@saadpasta/why-react-is-the-best-5a97563f423e",
      title: "Why REACT is The Best?",
      description:
        "React is a JavaScript library for building User Interface. It is maintained by Facebook and a community of individual developers and companies."
    },
    {
      url: "https://medium.com/@saadpasta/why-react-is-the-best-5a97563f423e",
      title: "Why REACT is The Best?",
      description:
        "React is a JavaScript library for building User Interface. It is maintained by Facebook and a community of individual developers and companies."
    },
  ]
};

// Talks Sections

const talkSection = {
  display: false, // Set false to hide this section, defaults to true
  title: "TALKS",
  subtitle: emoji(
    "I LOVE TO SHARE MY LIMITED KNOWLEDGE AND GET A SPEAKER BADGE 😅"
  ),

  talks: [
    {
      title: "Build Actions For Google Assistant",
      subtitle: "Codelab at GDG DevFest Karachi 2019",
      slides_url: "https://bit.ly/saadpasta-slides",
      event_url: "https://www.facebook.com/events/2339906106275053/"
    },
    {
      title: "Build Actions For Google Assistant",
      subtitle: "Codelab at GDG DevFest Karachi 2019",
      slides_url: "https://bit.ly/saadpasta-slides",
      event_url: "https://www.facebook.com/events/2339906106275053/"
    },
    {
      title: "Build Actions For Google Assistant",
      subtitle: "Codelab at GDG DevFest Karachi 2019",
      slides_url: "https://bit.ly/saadpasta-slides",
      event_url: "https://www.facebook.com/events/2339906106275053/"
    }
  ]
};

// Podcast Section

const podcastSection = {
  display: false, // Set false to hide this section, defaults to true
  title: emoji("Podcast 🎙️"),
  subtitle: "I LOVE TO TALK ABOUT MYSELF AND TECHNOLOGY",

  // Please Provide with Your Podcast embeded Link
  podcast: [
    "https://anchor.fm/codevcast/embed/episodes/DevStory---Saad-Pasta-from-Karachi--Pakistan-e9givv/a-a15itvo"
  ]
};

const contactInfo = {
  title: emoji("Reach out to me"),
  subtitle:
    "Just want to say hi? Talk AGI? Discuss a project?",
  twitter_url: "https://twitter.com/RomainClaret",
  twitter_desc: "Drop me a line on Twitter",
  newTab: "true",
  email_address: "romain.claret {at} unine.ch",
  email_desc: "Or email:",
};

// Twitter Section

const twitterDetails = {
  display: false, // Set true to display this section, defaults to false
  userName: "RomainClaret" //Replace "twitter" with your twitter username without @
};

export {
  illustration,
  greeting,
  socialMediaLinks,
  skillsSection,
  educationInfo,
  techStack,
  workExperiences,
  openSource,
  bigProjects,
  achievementSection,
  papersSection,
  blogSection,
  talkSection,
  podcastSection,
  contactInfo,
  twitterDetails
};
