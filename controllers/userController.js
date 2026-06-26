const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    // Exclude the passwordHash for security
    const user = await User.findById(req.user._id).select('-passwordHash'); 
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    // SECURITY: We manually destructure ONLY the fields we allow the user to edit.
    // If they send "walletBalance" in req.body, it gets completely ignored here.
    const { bio, location, website, socials, skillsOffered, skillsDesired } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: { bio, location, website, socials, skillsOffered, skillsDesired }
      },
      { new: true, runValidators: true } 
    ).select('-passwordHash');

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};