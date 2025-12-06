/**
 * Article Rating and Voting Widget
 *
 * Comprehensive rating and voting component for knowledge base articles
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, ThumbsUp, ThumbsDown, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface ArticleRatingWidgetProps {
  articleId: string;
  showReviews?: boolean;
  compact?: boolean;
}

interface RatingStats {
  average: number;
  total: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

interface VoteStats {
  helpful: number;
  notHelpful: number;
  outdated: number;
  inaccurate: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  verifiedReader: boolean;
  helpfulCount: number;
  createdAt: string;
}

export function ArticleRatingWidget({
  articleId,
  showReviews = true,
  compact = false,
}: ArticleRatingWidgetProps) {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rating statistics
  const { data: ratingsData, isLoading } = useQuery({
    queryKey: ['article-ratings', articleId],
    queryFn: async () => {
      const response = await fetch(`/api/knowledge-base/ratings/${articleId}`);
      if (!response.ok) throw new Error('Failed to fetch ratings');
      return response.json();
    },
  });

  // Fetch user's rating
  const { data: userRatingData } = useQuery({
    queryKey: ['user-rating', articleId],
    queryFn: async () => {
      const response = await fetch(`/api/knowledge-base/ratings/user/${articleId}`);
      if (!response.ok) throw new Error('Failed to fetch user rating');
      return response.json();
    },
  });

  // Fetch user's vote
  const { data: userVoteData } = useQuery({
    queryKey: ['user-vote', articleId],
    queryFn: async () => {
      const response = await fetch(`/api/knowledge-base/votes/user/${articleId}`);
      if (!response.ok) throw new Error('Failed to fetch user vote');
      return response.json();
    },
  });

  // Submit rating mutation
  const submitRating = useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment?: string }) => {
      const response = await fetch('/api/knowledge-base/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, rating, comment }),
      });
      if (!response.ok) throw new Error('Failed to submit rating');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article-ratings', articleId] });
      queryClient.invalidateQueries({ queryKey: ['user-rating', articleId] });
      toast({
        title: 'Rating submitted',
        description: 'Thank you for your feedback!',
      });
      setShowCommentBox(false);
      setComment('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit rating. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Submit vote mutation
  const submitVote = useMutation({
    mutationFn: async (voteType: string) => {
      const response = await fetch('/api/knowledge-base/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, voteType }),
      });
      if (!response.ok) throw new Error('Failed to submit vote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article-ratings', articleId] });
      queryClient.invalidateQueries({ queryKey: ['user-vote', articleId] });
      toast({
        title: 'Vote recorded',
        description: 'Thank you for your feedback!',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit vote. Please try again.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (userRatingData?.rating) {
      setSelectedRating(userRatingData.rating.rating);
    }
  }, [userRatingData]);

  const ratings: RatingStats = ratingsData?.ratings || {
    average: 0,
    total: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };

  const votes: VoteStats = ratingsData?.votes || {
    helpful: 0,
    notHelpful: 0,
    outdated: 0,
    inaccurate: 0,
  };

  const reviews: Review[] = ratingsData?.recentReviews || [];

  const handleRatingClick = (rating: number) => {
    setSelectedRating(rating);
    setShowCommentBox(true);
  };

  const handleSubmitRating = () => {
    if (selectedRating === 0) {
      toast({
        title: 'No rating selected',
        description: 'Please select a rating before submitting.',
        variant: 'destructive',
      });
      return;
    }
    submitRating.mutate({ rating: selectedRating, comment: comment || undefined });
  };

  const handleVote = (voteType: string) => {
    submitVote.mutate(voteType);
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && handleRatingClick(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
          >
            <Star
              className={`w-6 h-6 ${
                star <= (interactive ? hoverRating || selectedRating : rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const getPercentage = (count: number) => {
    return ratings.total > 0 ? Math.round((count / ratings.total) * 100) : 0;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {renderStars(ratings.average)}
          <span className="text-sm text-gray-600">
            {ratings.average.toFixed(1)} ({ratings.total} {ratings.total === 1 ? 'rating' : 'ratings'})
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={userVoteData?.vote?.voteType === 'helpful' ? 'default' : 'outline'}
            onClick={() => handleVote('helpful')}
            className="gap-1"
          >
            <ThumbsUp className="w-4 h-4" />
            {votes.helpful}
          </Button>
          <Button
            size="sm"
            variant={userVoteData?.vote?.voteType === 'not_helpful' ? 'default' : 'outline'}
            onClick={() => handleVote('not_helpful')}
            className="gap-1"
          >
            <ThumbsDown className="w-4 h-4" />
            {votes.notHelpful}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Article Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating Summary */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-5xl font-bold">{ratings.average.toFixed(1)}</div>
              <div className="flex justify-center my-2">{renderStars(ratings.average)}</div>
              <div className="text-sm text-gray-600">
                Based on {ratings.total} {ratings.total === 1 ? 'rating' : 'ratings'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-2">
                <div className="flex items-center gap-1 w-16">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{star}</span>
                </div>
                <Progress value={getPercentage(ratings.distribution[star as keyof typeof ratings.distribution])} className="flex-1" />
                <span className="text-sm text-gray-600 w-12 text-right">
                  {getPercentage(ratings.distribution[star as keyof typeof ratings.distribution])}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* User Rating */}
        <div className="space-y-4">
          <h3 className="font-semibold">Rate this article</h3>
          {renderStars(selectedRating, true)}
          {userRatingData?.hasRated && (
            <Badge variant="secondary">You rated this {selectedRating} stars</Badge>
          )}

          {showCommentBox && (
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment about this article (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button onClick={handleSubmitRating} disabled={submitRating.isPending}>
                  {userRatingData?.hasRated ? 'Update Rating' : 'Submit Rating'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCommentBox(false);
                    setComment('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Feedback */}
        <div className="space-y-4">
          <h3 className="font-semibold">Was this article helpful?</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              variant={userVoteData?.vote?.voteType === 'helpful' ? 'default' : 'outline'}
              onClick={() => handleVote('helpful')}
              className="gap-2"
            >
              <ThumbsUp className="w-4 h-4" />
              Helpful ({votes.helpful})
            </Button>
            <Button
              variant={userVoteData?.vote?.voteType === 'not_helpful' ? 'default' : 'outline'}
              onClick={() => handleVote('not_helpful')}
              className="gap-2"
            >
              <ThumbsDown className="w-4 h-4" />
              Not Helpful ({votes.notHelpful})
            </Button>
            <Button
              variant={userVoteData?.vote?.voteType === 'outdated' ? 'default' : 'outline'}
              onClick={() => handleVote('outdated')}
              className="gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Outdated ({votes.outdated})
            </Button>
            <Button
              variant={userVoteData?.vote?.voteType === 'inaccurate' ? 'default' : 'outline'}
              onClick={() => handleVote('inaccurate')}
              className="gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Inaccurate ({votes.inaccurate})
            </Button>
          </div>
        </div>

        {/* Recent Reviews */}
        {showReviews && reviews.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold">Recent Reviews</h3>
              {reviews.map((review) => (
                <div key={review.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      {review.verifiedReader && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Verified Reader
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  )}
                  {review.helpfulCount > 0 && (
                    <div className="text-xs text-gray-500">
                      {review.helpfulCount} {review.helpfulCount === 1 ? 'person' : 'people'} found this helpful
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
