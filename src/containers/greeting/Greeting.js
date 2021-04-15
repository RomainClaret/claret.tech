import React, {useContext, useState} from "react";
import {Fade} from "react-reveal";
import emoji from "react-easy-emoji";
import "./Greeting.css";
import landingPerson from "../../assets/lottie/landingPerson";
import DisplayLottie from "../../components/displayLottie/DisplayLottie";
import SocialMedia from "../../components/socialMedia/SocialMedia";
import Button from "../../components/button/Button";
import Typical from 'react-typical'
//import { Modal } from 'react-modal-overlay'
//import { Document, Page } from 'react-pdf';
//import { Document, Page } from 'react-pdf/dist/umd/entry.webpack';


import {illustration, greeting} from "../../portfolio";
import StyleContext from "../../contexts/StyleContext";
import '../../components/modalOverlay/ModalOverlay.css'

/*const options = {
  cMapUrl: 'cmaps/',
  cMapPacked: true,
};
*/

export default function Greeting() {
  const {isDark} = useContext(StyleContext);
  //const [isOpen, setIsOpen] = useState(false)
  //const [file, setFile] = useState('https://claret.tech/assets/documents/RomainClaret_CV.pdf');
  //const [numPages, setNumPages] = useState(null);
  //const [pageNumber, setPageNumber] = useState(1);

  if (!greeting.displayGreeting) {
    return null;
  }
  //function onFileChange(event) {
  //  setFile(event.target.files[0]);
  //}
  //function onDocumentLoadSuccess({ numPages }) {
  //  setNumPages(numPages);
  //}

  return (
    <Fade bottom duration={1000} distance="40px">
      <div className="greet-main" id="greeting">
        <div className="greeting-main">
          <div className="greeting-text-div">
            <div>
              <h1
                className={isDark ? "dark-mode greeting-text" : "greeting-text"}
              >
                {" "}
                {greeting.title_greeting}{" "}
                <span className="wave-emoji">{emoji("👋")}</span>
                </h1>
              <p
                className={
                  isDark
                    ? "dark-mode greeting-text-p"
                    : "greeting-text-p subTitle"
                }
              >
                {greeting.title_greeting_newline}{" "}
                <Typical
                  steps={greeting.title_greeting_title_list}
                  loop={Infinity}
                  wrapper="span"
                />
                <br/>
                {greeting.subTitle}
              </p>
              <SocialMedia />
              <div className="button-greeting-div">
                <Button text="Contact me" href="#contact" />
                {/*<Button
                  text="See resume modal"
                  newTab={true}
                  onClick={() => setIsOpen(true)}
                />*/}
                <Button
                  text="See resume"
                  newTab={true}
                  href={greeting.resumeLink}
                />
              </div>
            </div>
          </div>
          <div className="greeting-image-div">
            {illustration.animated ? (
              <DisplayLottie animationData={landingPerson} />
            ) : (
              <img
                alt="man sitting on table"
                src={require("../../assets/images/manOnTable.svg")}
              ></img>
            )}
          </div>
        </div>
      </div>
      <div>
      {/*
      <Modal show={isOpen} closeModal={() => setIsOpen(false)}>
      <div>
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
      >
        <Page pageNumber={pageNumber} />
      </Document>
      <p>Page {pageNumber} of {numPages}</p>
    </div>
      </Modal>
    */}
    </div>
    </Fade>
  );
}
