import React, {useContext} from "react";
import Headroom from "react-headroom";
import "./Header.css";
import ToggleSwitch from "../ToggleSwitch/ToggleSwitch";
import StyleContext from "../../contexts/StyleContext";
import {
  greeting,
  workExperiences,
  skillsSection,
  openSource,
  blogSection,
  talkSection,
  achievementSection,
  papersSection
} from "../../portfolio";

var cursor = true;
var speed = 1000;
setInterval(() => {
if(cursor) {
document.getElementById('logo__cursor').style.opacity = 0;
cursor = false;
}else {
document.getElementById('logo__cursor').style.opacity = 1;
cursor = true;
}
}, speed);

function Header() {
  const {isDark} = useContext(StyleContext);
  const viewExperience = workExperiences.display;
  const viewOpenSource = openSource.display;
  const viewSkills = skillsSection.display;
  //const viewEducation = educationSection.display;
  const viewAchievement = achievementSection.display;
  const viewPapers = papersSection.display;
  const viewBlog = blogSection.display;
  const viewTalks = talkSection.display;

  return (    
    <Headroom>
      <header className={isDark ? "dark-menu header" : "header"}>
        <a href="/" className="logo">
          <span className="grey-color">(base) guest@</span>
          <span className="logo-name">{greeting.username}</span>
          <span className="grey-color">~ $ </span>
          <span className="grey-color" id="logo__cursor" style={{
            width: "10px !important",
            background: "#20C20E",
            display: "inline-block", 
            "margin-left": "5px",
            "border-radius": "1px"
            }}>&nbsp; &nbsp;</span>
        </a>
        <input className="menu-btn" type="checkbox" id="menu-btn" />
        <label
          className="menu-icon"
          htmlFor="menu-btn"
          style={{color: "white"}}
        >
          <span className={isDark ? "navicon navicon-dark" : "navicon"}></span>
        </label>
        <ul className={isDark ? "dark-menu menu" : "menu"}>
          {viewSkills && (
            <li>
              <a href="#skills">Skills</a>
            </li>
          )}
          {viewExperience && (
            <li>
              <a href="#experience">Work Experiences</a>
            </li>
          )}
          {viewAchievement && (
            <li>
              <a href="#achievements">Achievements</a>
            </li>
          )}
          {viewPapers && (
            <li>
              <a href="#papers">Papers</a>
            </li>
          )}
          {viewBlog && (
            <li>
              <a href="#blogs">Blogs</a>
            </li>
          )}
          {viewTalks && (
            <li>
              <a href="#talks">Talks</a>
            </li>
          )}
          {viewOpenSource && (
            <li>
              <a href="#opensource">Repositories</a>
            </li>
          )}
          <li>
            <a href="#contact">Contact Me</a>
          </li>
          <li>
            <a href="#mycontact">
              <ToggleSwitch />
            </a>
          </li>
        </ul>
      </header>
    </Headroom>
  );
}
export default Header;
