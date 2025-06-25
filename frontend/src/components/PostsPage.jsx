import React, { useEffect, useState } from 'react';
import Navigation from './Navigation';
import { useUser } from '../context/UserContext';

const PostsPage = () => {
  const { user } = useUser();
  const [publishedPosts, setPublishedPosts] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const fetchPublishedPosts = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_BASE}/published-posts`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (data.success) setPublishedPosts(data.posts);
      } catch (err) {
        // handle error
      }
    };
    fetchPublishedPosts();
  }, [API_BASE, user]);

  return (
    <div className="container mx-auto px-4 py-8">
      <Navigation />
      <h2 className="text-3xl font-bold mb-6">Published Blog Posts</h2>
      <div className="grid gap-4">
        {!publishedPosts ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading posts...</p>
          </div>
        ) : publishedPosts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500">No published posts found.</p>
          </div>
        ) : (
          publishedPosts.map((post) => (
            <div key={post.id || post._id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">{post.title}</h3>
              <div className="flex flex-col gap-2 text-gray-600">
                <p>
                  <span className="font-medium">Site:</span>{' '}
                  <a href={post.siteUrl} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {post.siteUrl}
                  </a>
                </p>
                <p>
                  <span className="font-medium">Post:</span>{' '}
                  <a href={post.postUrl} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    View Article
                  </a>
                </p>
                <p className="text-sm text-gray-500">
                  Published: {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PostsPage;
