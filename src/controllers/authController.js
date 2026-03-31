exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login | SpaceTrack', layout: false });
};

exports.postLogin = (req, res) => {
  const { username, password } = req.body;
  // Basic mock authentication
  if (username && password) {
    req.session.user = { username, id: Date.now() };
    return res.redirect('/');
  }
  res.redirect('/auth/login');
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/');
};
