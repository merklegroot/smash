# Kanji Smash

Whack-a-mole style kanji training

## Initial Kanji

The user's training set should consist of just a few of the most basic kanji.  

## Success and failure

When the user selects the correct answer, the kanji is given a green pip.  
When the user selects the wrong answer, the kanji is given a red pip.  

A kanji can have have a max of 8 pips.  
Once it gets 8, new pips overwrite the old ones.  

## Training strategy

-- TODO: This strategy isn't fully thought through.

Enough successes for a kanji should cause the kanji not to be in the training set for a while.

Failure should make a kanji to be more likely to be quizzed on.

New kanji should be able to enter the training set when th user has demonstrated that there's space for them to be added to the training set.

