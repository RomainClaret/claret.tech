function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var React = _interopDefault(require('react'));

var ModalStyle = {"modal":"_Xt-75","modalContent":"_3bARu","close":"_2I1sI","overlay":"_3qw0K"};

var Modal = function Modal(_ref) {
  var children = _ref.children,
      className = _ref.className,
      show = _ref.show,
      closeModal = _ref.closeModal;
  return /*#__PURE__*/React.createElement("div", {
    className: ModalStyle.modal + " " + className,
    style: {
      display: show ? 'block' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: ModalStyle.overlay,
    onClick: closeModal
  }), /*#__PURE__*/React.createElement("div", {
    className: ModalStyle.modalContent
  }, /*#__PURE__*/React.createElement("span", {
    className: ModalStyle.close,
    onClick: closeModal
  }, "\xD7"), children));
};

exports.Modal = Modal;
//# sourceMappingURL=index.js.map
